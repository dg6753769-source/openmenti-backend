/**
 * FHIR R4 compliant REST API
 * Supports: Patient, Observation, Condition, Encounter, MedicationRequest
 * Content-Type: application/fhir+json
 */
import { Router } from 'express';
import Patient from '../models/Patient.js';
import Observation from '../models/Observation.js';
import Condition from '../models/Condition.js';
import Encounter from '../models/Encounter.js';
import MedicationRequest from '../models/MedicationRequest.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';
import {
  toFHIRPatient, fromFHIRPatient,
  toFHIRObservation, toFHIRCondition,
  toFHIREncounter, toFHIRMedicationRequest,
  buildFHIRBundle
} from '../services/fhirMapper.js';

const router = Router();
router.use((req, res, next) => {
  if (req.path === '/metadata') return next();
  return authenticate(req, res, next);
});

const fhirContent = (req, res, next) => {
  res.setHeader('Content-Type', 'application/fhir+json; charset=utf-8');
  next();
};

const fhirError = (res, status, code, message) => res.status(status).json({
  resourceType: 'OperationOutcome',
  issue: [{ severity: 'error', code, diagnostics: message }]
});

// Capability statement
router.get('/metadata', (req, res) => {
  res.setHeader('Content-Type', 'application/fhir+json');
  res.json({
    resourceType: 'CapabilityStatement',
    status: 'active',
    date: new Date().toISOString(),
    kind: 'instance',
    software: { name: 'HealthBridge FHIR Server', version: '1.0.0' },
    fhirVersion: '4.0.1',
    format: ['application/fhir+json'],
    rest: [{
      mode: 'server',
      resource: [
        { type: 'Patient', interaction: [{ code: 'read' }, { code: 'search-type' }, { code: 'create' }, { code: 'update' }] },
        { type: 'Observation', interaction: [{ code: 'read' }, { code: 'search-type' }, { code: 'create' }] },
        { type: 'Condition', interaction: [{ code: 'read' }, { code: 'search-type' }, { code: 'create' }] },
        { type: 'Encounter', interaction: [{ code: 'read' }, { code: 'search-type' }, { code: 'create' }] },
        { type: 'MedicationRequest', interaction: [{ code: 'read' }, { code: 'search-type' }, { code: 'create' }] }
      ]
    }]
  });
});

// ─── Patient ────────────────────────────────────────────────────────────────

router.get('/Patient', authorize('fhir:read'), fhirContent, async (req, res) => {
  try {
    const filter = { organization: req.orgId, isDeleted: false };
    if (req.query.family) filter['name.family'] = { $regex: req.query.family, $options: 'i' };
    if (req.query.given) filter['name.given'] = { $regex: req.query.given, $options: 'i' };
    if (req.query.birthdate) filter.birthDate = new Date(req.query.birthdate);
    if (req.query.gender) filter.gender = req.query.gender;
    if (req.query.identifier) filter['identifiers.value'] = req.query.identifier;

    const count = parseInt(req.query._count) || 20;
    const patients = await Patient.find(filter).limit(Math.min(count, 100)).lean({ virtuals: true });
    res.json(buildFHIRBundle(patients.map(toFHIRPatient)));
  } catch (err) {
    fhirError(res, 500, 'exception', err.message);
  }
});

router.get('/Patient/:id', authorize('fhir:read'), fhirContent, async (req, res) => {
  try {
    const patient = await Patient.findOne({
      $or: [{ fhirId: req.params.id }, { _id: req.params.id.length === 24 ? req.params.id : null }],
      organization: req.orgId, isDeleted: false
    }).lean({ virtuals: true });
    if (!patient) return fhirError(res, 404, 'not-found', `Patient/${req.params.id} not found`);
    res.json(toFHIRPatient(patient));
  } catch (err) {
    fhirError(res, 500, 'exception', err.message);
  }
});

router.post('/Patient', authorize('fhir:write'), fhirContent, async (req, res) => {
  try {
    if (req.body.resourceType !== 'Patient') {
      return fhirError(res, 400, 'invalid', 'Expected resourceType: Patient');
    }
    const data = fromFHIRPatient(req.body, req.orgId);
    const patient = await Patient.create(data);
    res.status(201).json(toFHIRPatient(patient.toObject({ virtuals: true })));
  } catch (err) {
    fhirError(res, 500, 'exception', err.message);
  }
});

router.put('/Patient/:id', authorize('fhir:write'), fhirContent, async (req, res) => {
  try {
    const update = fromFHIRPatient(req.body, req.orgId);
    const patient = await Patient.findOneAndUpdate(
      { fhirId: req.params.id, organization: req.orgId },
      update, { new: true, upsert: true, runValidators: true }
    ).lean({ virtuals: true });
    res.json(toFHIRPatient(patient));
  } catch (err) {
    fhirError(res, 500, 'exception', err.message);
  }
});

// ─── Observation ────────────────────────────────────────────────────────────

router.get('/Observation', authorize('fhir:read'), fhirContent, async (req, res) => {
  try {
    const filter = { organization: req.orgId };
    if (req.query.patient) filter.patient = req.query.patient;
    if (req.query.code) filter['code.code'] = req.query.code;
    if (req.query.category) filter.category = req.query.category;
    if (req.query['date']) filter.effectiveDateTime = { $gte: new Date(req.query.date) };

    const count = parseInt(req.query._count) || 20;
    const obs = await Observation.find(filter).sort({ effectiveDateTime: -1 }).limit(Math.min(count, 200)).lean();
    res.json(buildFHIRBundle(obs.map(toFHIRObservation)));
  } catch (err) {
    fhirError(res, 500, 'exception', err.message);
  }
});

router.get('/Observation/:id', authorize('fhir:read'), fhirContent, async (req, res) => {
  try {
    const obs = await Observation.findOne({ fhirId: req.params.id, organization: req.orgId }).lean();
    if (!obs) return fhirError(res, 404, 'not-found', `Observation/${req.params.id} not found`);
    res.json(toFHIRObservation(obs));
  } catch (err) {
    fhirError(res, 500, 'exception', err.message);
  }
});

// ─── Condition ──────────────────────────────────────────────────────────────

router.get('/Condition', authorize('fhir:read'), fhirContent, async (req, res) => {
  try {
    const filter = { organization: req.orgId };
    if (req.query.patient) filter.patient = req.query.patient;
    if (req.query['clinical-status']) filter.clinicalStatus = req.query['clinical-status'];
    if (req.query.code) filter['code.code'] = { $regex: `^${req.query.code}`, $options: 'i' };

    const count = parseInt(req.query._count) || 20;
    const conditions = await Condition.find(filter).limit(Math.min(count, 100)).lean();
    res.json(buildFHIRBundle(conditions.map(toFHIRCondition)));
  } catch (err) {
    fhirError(res, 500, 'exception', err.message);
  }
});

router.get('/Condition/:id', authorize('fhir:read'), fhirContent, async (req, res) => {
  try {
    const cond = await Condition.findOne({ fhirId: req.params.id, organization: req.orgId }).lean();
    if (!cond) return fhirError(res, 404, 'not-found', `Condition/${req.params.id} not found`);
    res.json(toFHIRCondition(cond));
  } catch (err) {
    fhirError(res, 500, 'exception', err.message);
  }
});

// ─── Encounter ──────────────────────────────────────────────────────────────

router.get('/Encounter', authorize('fhir:read'), fhirContent, async (req, res) => {
  try {
    const filter = { organization: req.orgId };
    if (req.query.patient) filter.patient = req.query.patient;
    if (req.query.status) filter.status = req.query.status;
    if (req.query['date']) filter['period.start'] = { $gte: new Date(req.query.date) };

    const count = parseInt(req.query._count) || 20;
    const encs = await Encounter.find(filter).sort({ 'period.start': -1 }).limit(Math.min(count, 100)).lean();
    res.json(buildFHIRBundle(encs.map(toFHIREncounter)));
  } catch (err) {
    fhirError(res, 500, 'exception', err.message);
  }
});

// ─── MedicationRequest ───────────────────────────────────────────────────────

router.get('/MedicationRequest', authorize('fhir:read'), fhirContent, async (req, res) => {
  try {
    const filter = { organization: req.orgId };
    if (req.query.patient) filter.patient = req.query.patient;
    if (req.query.status) filter.status = req.query.status;

    const count = parseInt(req.query._count) || 20;
    const meds = await MedicationRequest.find(filter).sort({ authoredOn: -1 }).limit(Math.min(count, 100)).lean();
    res.json(buildFHIRBundle(meds.map(toFHIRMedicationRequest)));
  } catch (err) {
    fhirError(res, 500, 'exception', err.message);
  }
});

// ─── FHIR Bundle (transaction) ───────────────────────────────────────────────

router.post('/Bundle', authorize('fhir:write'), fhirContent, async (req, res) => {
  if (req.body.resourceType !== 'Bundle' || req.body.type !== 'transaction') {
    return fhirError(res, 400, 'invalid', 'Expected Bundle type: transaction');
  }
  const results = [];
  for (const entry of (req.body.entry || [])) {
    const resource = entry.resource;
    try {
      if (resource.resourceType === 'Patient') {
        const data = fromFHIRPatient(resource, req.orgId);
        const p = await Patient.findOneAndUpdate({ fhirId: data.fhirId, organization: req.orgId }, data, { upsert: true, new: true });
        results.push({ status: '200 OK', resource: toFHIRPatient(p.toObject({ virtuals: true })) });
      } else {
        results.push({ status: '422 Unprocessable', issue: `ResourceType ${resource.resourceType} not supported in transaction` });
      }
    } catch (err) {
      results.push({ status: '500 Error', issue: err.message });
    }
  }
  res.json({ resourceType: 'Bundle', type: 'transaction-response', entry: results });
});

export default router;
