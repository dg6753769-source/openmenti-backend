/**
 * In-memory database using nedb — patches Mongoose model static methods
 * so the server runs without MongoDB. Perfect for demo/dev environments.
 */
import Nedb from '@seald-io/nedb';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const stores = {};

const col = (name) => {
  if (!stores[name]) stores[name] = new Nedb({ inMemoryOnly: true });
  return stores[name];
};

const run = (db, method, ...args) => new Promise((res, rej) =>
  db[method](...args, (err, result) => err ? rej(err) : res(result))
);

const idStr = (v) => (v == null ? undefined : v.toString());

// Strip functions and reserved keys from a doc before storing in nedb
const toRaw = (doc, excludeNames = []) => {
  const raw = {};
  for (const [k, v] of Object.entries(doc)) {
    if (typeof v === 'function') continue;
    if (['save', 'populate', 'toObject', 'toJSON', 'id', ...excludeNames].includes(k)) continue;
    raw[k] = v;
  }
  return raw;
};

// Convert Mongoose ObjectIds → strings recursively
const normalizeIds = (v) => {
  if (v == null) return v;
  if (v._bsontype) return v.toString();
  if (Array.isArray(v)) return v.map(normalizeIds);
  if (v instanceof Date) return v;
  if (typeof v === 'object') {
    const out = {};
    for (const [k, val] of Object.entries(v)) out[k] = normalizeIds(val);
    return out;
  }
  return v;
};

// Apply Mongoose schema defaults by constructing a model instance
const applyDefaults = (Model, data) => {
  try {
    const instance = new Model(data);
    const raw = instance.toObject({ depopulate: true, transform: false });
    return normalizeIds(raw);
  } catch {
    return normalizeIds({ ...data });
  }
};

const adaptFilter = (filter) => {
  if (!filter || typeof filter !== 'object') return {};
  const out = {};
  for (const [k, v] of Object.entries(filter)) {
    if (k === '$or' || k === '$and' || k === '$nor') {
      out[k] = (Array.isArray(v) ? v : [v]).map(adaptFilter);
    } else if (v?._bsontype) {
      out[k] = v.toString();
    } else if (v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date) && !(v instanceof RegExp)) {
      const inner = {};
      for (const [op, ov] of Object.entries(v)) {
        if (op === '$in' || op === '$nin') {
          inner[op] = (Array.isArray(ov) ? ov : [ov]).map(i => (i?._bsontype ? i.toString() : i));
        } else if (ov?._bsontype) {
          inner[op] = ov.toString();
        } else {
          inner[op] = ov;
        }
      }
      out[k] = inner;
    } else {
      out[k] = v;
    }
  }
  return out;
};

const applyUpdate = (existing, update) => {
  const doc = { ...existing };
  if (!update || typeof update !== 'object') return doc;

  const hasOps = ['$set','$unset','$inc','$push','$pull','$max','$min'].some(k => k in update);
  if (!hasOps) {
    return { ...doc, ...normalizeIds(update), _id: doc._id, createdAt: doc.createdAt, updatedAt: new Date() };
  }
  if (update.$set) {
    for (const [k, v] of Object.entries(update.$set)) {
      if (k.includes('.')) {
        const parts = k.split('.');
        let ref = doc;
        for (let i = 0; i < parts.length - 1; i++) {
          if (ref[parts[i]] == null) ref[parts[i]] = isNaN(parseInt(parts[i + 1])) ? {} : [];
          ref = ref[parts[i]];
        }
        ref[parts[parts.length - 1]] = v;
      } else {
        doc[k] = v;
      }
    }
  }
  if (update.$unset) Object.keys(update.$unset).forEach(k => delete doc[k]);
  if (update.$inc) {
    for (const [k, v] of Object.entries(update.$inc)) doc[k] = (doc[k] || 0) + v;
  }
  if (update.$push) {
    for (const [k, v] of Object.entries(update.$push)) {
      if (!Array.isArray(doc[k])) doc[k] = [];
      doc[k].push(v);
    }
  }
  if (update.$max) {
    for (const [k, v] of Object.entries(update.$max)) {
      if (doc[k] == null || doc[k] < v) doc[k] = v;
    }
  }
  doc.updatedAt = new Date();
  return doc;
};

// Build a Mongoose-like wrapper that attaches schema instance methods
const makeWrapper = (db, methodNames = []) => (raw) => {
  if (!raw) return null;
  const doc = { ...raw };
  doc.id = doc._id;

  doc.toObject = (opts) => {
    const obj = { ...doc };
    // Compute virtuals if requested
    if (opts?.virtuals) {
      if (Array.isArray(obj.name) && obj.name.length) {
        const n = obj.name.find(x => x.use === 'official') || obj.name[0];
        if (n) obj.fullName = [n.given?.join(' '), n.family].filter(Boolean).join(' ');
      }
      if (obj.birthDate) {
        const today = new Date();
        let age = today.getFullYear() - new Date(obj.birthDate).getFullYear();
        const m = today.getMonth() - new Date(obj.birthDate).getMonth();
        if (m < 0 || (m === 0 && today.getDate() < new Date(obj.birthDate).getDate())) age--;
        obj.age = age;
      }
    }
    // Strip methods from returned plain object
    methodNames.forEach(n => delete obj[n]);
    return obj;
  };
  doc.toJSON = () => doc.toObject({ virtuals: true });
  doc.populate = async () => doc;

  doc.save = async () => {
    doc.updatedAt = new Date();
    await run(db, 'update', { _id: doc._id }, toRaw(doc, methodNames), {});
    return doc;
  };

  return doc;
};

// Bind schema.methods onto wrapped docs (must be done after wrapDoc)
const bindMethods = (doc, schema) => {
  if (!doc || !schema?.methods) return doc;
  for (const [name, fn] of Object.entries(schema.methods)) {
    doc[name] = fn.bind(doc);
  }
  return doc;
};

class NedbQuery {
  constructor(db, type, filter, wrapDoc) {
    this._db = db;
    this._type = type;
    this._filter = filter || {};
    this._wrapDoc = wrapDoc;
    this._sortSpec = null;
    this._skipN = 0;
    this._limitN = 0;
  }

  sort(s) { this._sortSpec = s; return this; }
  skip(n) { this._skipN = n || 0; return this; }
  limit(n) { this._limitN = n || 0; return this; }
  lean() { return this; }
  select() { return this; }
  populate() { return this; }

  async exec() {
    const f = adaptFilter(this._filter);
    if (this._type === 'findOne') {
      const doc = await run(this._db, 'findOne', f);
      return this._wrapDoc(doc);
    }
    let cursor = this._db.find(f);
    if (this._sortSpec) cursor = cursor.sort(this._sortSpec);
    if (this._skipN) cursor = cursor.skip(this._skipN);
    if (this._limitN) cursor = cursor.limit(this._limitN);
    const docs = await new Promise((res, rej) => cursor.exec((e, r) => e ? rej(e) : res(r)));
    return docs.map(this._wrapDoc);
  }

  then(res, rej) { return this.exec().then(res, rej); }
  catch(rej) { return this.exec().catch(rej); }
}

const patchModel = (Model) => {
  const db = col(Model.modelName);
  const schema = Model.schema;
  const methodNames = Object.keys(schema?.methods || {});
  const wrap = makeWrapper(db, methodNames);
  const wrapDoc = (raw) => bindMethods(wrap(raw), schema);

  const processOne = async (data) => {
    // Use new Model() to apply schema defaults
    const withDefaults = applyDefaults(Model, data);
    withDefaults._id = idStr(data._id || withDefaults._id) || new mongoose.Types.ObjectId().toString();
    const now = new Date();
    withDefaults.createdAt = withDefaults.createdAt || now;
    withDefaults.updatedAt = now;

    // Hash password if present and unhashed (handles User pre-save hook)
    if (withDefaults.password &&
        !withDefaults.password.startsWith('$2b$') &&
        !withDefaults.password.startsWith('$2a$')) {
      withDefaults.password = await bcrypt.hash(withDefaults.password, 12);
    }

    const inserted = await run(db, 'insert', withDefaults);
    return wrapDoc(inserted);
  };

  Model.find = (filter) => new NedbQuery(db, 'find', filter, wrapDoc);
  Model.findOne = (filter) => new NedbQuery(db, 'findOne', filter, wrapDoc);
  Model.findById = (id) => new NedbQuery(db, 'findOne', { _id: idStr(id) }, wrapDoc);

  Model.countDocuments = async (filter = {}) => run(db, 'count', adaptFilter(filter));

  Model.create = async (data) => {
    if (Array.isArray(data)) return Promise.all(data.map(processOne));
    return processOne(data);
  };

  Model.findOneAndUpdate = async (filter, update, opts = {}) => {
    const f = adaptFilter(filter);
    let existing = await run(db, 'findOne', f);
    if (!existing && opts.upsert) {
      const now = new Date();
      existing = { ...f, _id: new mongoose.Types.ObjectId().toString(), createdAt: now };
    }
    if (!existing) return null;
    const updated = applyUpdate(existing, update);
    await run(db, 'update', { _id: existing._id }, updated, {});
    return wrapDoc(opts.new !== false ? updated : existing);
  };

  Model.findByIdAndUpdate = async (id, update, opts = {}) =>
    Model.findOneAndUpdate({ _id: idStr(id) }, update, opts);

  Model.updateMany = async (filter, update) => {
    const f = adaptFilter(filter);
    const docs = await run(db, 'find', f);
    for (const d of docs) await run(db, 'update', { _id: d._id }, applyUpdate(d, update), {});
    return { modifiedCount: docs.length };
  };

  Model.insertMany = async (docs, opts = {}) => {
    const results = await Promise.all(docs.map(processOne));
    return results;
  };

  Model.deleteMany = async (filter) => {
    const n = await run(db, 'remove', adaptFilter(filter), { multi: true });
    return { deletedCount: n };
  };

  Model.aggregate = async (pipeline) => {
    let result = await run(db, 'find', {});

    for (const stage of pipeline) {
      if (stage.$match) {
        const f = adaptFilter(stage.$match);
        result = result.filter(doc =>
          Object.entries(f).every(([k, v]) => {
            const docVal = k.split('.').reduce((o, p) => o?.[p], doc);
            if (v == null) return docVal == null;
            if (typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date)) {
              if ('$gte' in v && '$lte' in v) return docVal >= v.$gte && docVal <= v.$lte;
              if ('$gte' in v) return docVal >= v.$gte;
              if ('$lte' in v) return docVal <= v.$lte;
              if (v.$in) return v.$in.map(String).includes(String(docVal));
              if (v.$nin) return !v.$nin.map(String).includes(String(docVal));
              if ('$ne' in v) return String(docVal) !== String(v.$ne);
              if ('$exists' in v) return v.$exists ? docVal != null : docVal == null;
              if ('$size' in v) return Array.isArray(docVal) && docVal.length === v.$size;
            }
            return String(docVal) === String(v);
          })
        );
      } else if (stage.$group) {
        const groupId = stage.$group._id;
        const groups = new Map();
        for (const doc of result) {
          const keyVal = (typeof groupId === 'string' && groupId.startsWith('$'))
            ? groupId.slice(1).split('.').reduce((o, p) => o?.[p], doc)
            : groupId;
          const key = String(keyVal);
          if (!groups.has(key)) groups.set(key, { _id: keyVal });
          const g = groups.get(key);
          for (const [field, expr] of Object.entries(stage.$group)) {
            if (field === '_id') continue;
            if (expr.$sum !== undefined) {
              const add = expr.$sum === 1 ? 1
                : (typeof expr.$sum === 'string' && expr.$sum.startsWith('$')
                    ? (expr.$sum.slice(1).split('.').reduce((o, p) => o?.[p], doc) || 0)
                    : (typeof expr.$sum === 'object' ? 1 : Number(expr.$sum) || 0));
              g[field] = (g[field] || 0) + add;
            }
            if (expr.$first !== undefined && g[field] === undefined) {
              g[field] = (typeof expr.$first === 'string' && expr.$first.startsWith('$'))
                ? expr.$first.slice(1).split('.').reduce((o, p) => o?.[p], doc)
                : expr.$first;
            }
            if (expr.$avg !== undefined && typeof expr.$avg === 'string') {
              const fld = expr.$avg.slice(1);
              g[`__${field}_s`] = (g[`__${field}_s`] || 0) + (doc[fld] || 0);
              g[`__${field}_c`] = (g[`__${field}_c`] || 0) + 1;
              g[field] = g[`__${field}_s`] / g[`__${field}_c`];
            }
          }
        }
        result = [...groups.values()];
      } else if (stage.$sort) {
        const entries = Object.entries(stage.$sort);
        result = [...result].sort((a, b) => {
          for (const [k, dir] of entries) {
            const av = k.split('.').reduce((o, p) => o?.[p], a);
            const bv = k.split('.').reduce((o, p) => o?.[p], b);
            if (av < bv) return -dir;
            if (av > bv) return dir;
          }
          return 0;
        });
      } else if (stage.$limit) {
        result = result.slice(0, stage.$limit);
      } else if (stage.$bucket) {
        const boundaries = stage.$bucket.boundaries;
        const buckets = boundaries.slice(0, -1).map(low => ({ _id: low, count: 0 }));
        for (const doc of result) {
          const val = doc.birthDate
            ? Math.floor((Date.now() - new Date(doc.birthDate)) / (365.25 * 86400000)) : 0;
          for (let i = boundaries.length - 2; i >= 0; i--) {
            if (val >= boundaries[i]) { buckets[i].count++; break; }
          }
        }
        result = buckets.filter(b => b.count > 0);
      }
    }
    return result;
  };
};

export const setupInMemoryDB = async (models) => {
  console.log('🗃️  Running with in-memory database (nedb) — data resets on restart');
  console.log('   Set MONGODB_URI in server/.env to persist data with real MongoDB\n');
  for (const model of Object.values(models)) {
    try { patchModel(model); } catch (e) { console.error(`Failed to patch ${model.modelName}:`, e.message); }
  }
};
