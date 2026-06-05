/**
 * FHIR R4 mapper — converts internal models ↔ FHIR R4 resources
 */

export const toFHIRPatient = (patient) => ({
  resourceType: 'Patient',
  id: patient.fhirId,
  meta: { lastUpdated: patient.updatedAt },
  identifier: patient.identifiers?.map(i => ({
    system: `urn:oid:${i.system || 'local'}`,
    value: i.value,
    type: { text: i.type }
  })) || [],
  active: patient.active,
  name: patient.name?.map(n => ({
    use: n.use,
    family: n.family,
    given: n.given || [],
    prefix: n.prefix ? [n.prefix] : undefined,
    suffix: n.suffix ? [n.suffix] : undefined
  })) || [],
  telecom: patient.telecom?.map(t => ({
    system: t.system, value: t.value, use: t.use
  })) || [],
  gender: patient.gender,
  birthDate: patient.birthDate?.toISOString().split('T')[0],
  deceasedBoolean: patient.deceased?.isDeceased,
  deceasedDateTime: patient.deceased?.date?.toISOString(),
  address: patient.address?.map(a => ({
    use: a.use,
    line: a.line || [],
    city: a.city,
    state: a.state,
    postalCode: a.postalCode,
    country: a.country
  })) || [],
  communication: patient.language ? [{ language: { text: patient.language }, preferred: true }] : [],
  generalPractitioner: patient.primaryProvider
    ? [{ reference: `Practitioner/${patient.primaryProvider}` }] : []
});

export const fromFHIRPatient = (fhirPatient, orgId) => ({
  fhirId: fhirPatient.id,
  organization: orgId,
  identifiers: fhirPatient.identifier?.map(i => ({
    system: i.system, value: i.value, type: i.type?.text
  })) || [],
  name: fhirPatient.name?.map(n => ({
    use: n.use || 'official',
    family: n.family,
    given: n.given || [],
    prefix: n.prefix?.[0],
    suffix: n.suffix?.[0]
  })) || [],
  birthDate: fhirPatient.birthDate ? new Date(fhirPatient.birthDate) : undefined,
  gender: fhirPatient.gender,
  active: fhirPatient.active !== false,
  telecom: fhirPatient.telecom?.map(t => ({ system: t.system, value: t.value, use: t.use })) || [],
  address: fhirPatient.address?.map(a => ({
    use: a.use, line: a.line || [],
    city: a.city, state: a.state, postalCode: a.postalCode, country: a.country
  })) || []
});

export const toFHIRObservation = (obs) => ({
  resourceType: 'Observation',
  id: obs.fhirId,
  meta: { lastUpdated: obs.updatedAt },
  status: obs.status,
  category: obs.category ? [{
    coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: obs.category }]
  }] : [],
  code: {
    coding: [{ system: obs.code.system, code: obs.code.code, display: obs.code.display }],
    text: obs.code.display
  },
  subject: { reference: `Patient/${obs.patient?.fhirId || obs.patient}` },
  encounter: obs.encounter ? { reference: `Encounter/${obs.encounter}` } : undefined,
  effectiveDateTime: obs.effectiveDateTime?.toISOString(),
  valueQuantity: obs.value?.quantity ? {
    value: obs.value.quantity.value,
    unit: obs.value.quantity.unit,
    system: obs.value.quantity.system || 'http://unitsofmeasure.org',
    code: obs.value.quantity.code || obs.value.quantity.unit
  } : undefined,
  valueString: obs.value?.string,
  valueBoolean: obs.value?.boolean,
  interpretation: obs.interpretation?.code ? [{
    coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation', code: obs.interpretation.code }],
    text: obs.interpretation.display
  }] : [],
  referenceRange: obs.referenceRange?.map(r => ({
    low: r.low?.value !== undefined ? { value: r.low.value, unit: r.low.unit } : undefined,
    high: r.high?.value !== undefined ? { value: r.high.value, unit: r.high.unit } : undefined,
    text: r.text
  })) || [],
  note: obs.note ? [{ text: obs.note }] : []
});

export const toFHIRCondition = (cond) => ({
  resourceType: 'Condition',
  id: cond.fhirId,
  meta: { lastUpdated: cond.updatedAt },
  clinicalStatus: {
    coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-clinical', code: cond.clinicalStatus }]
  },
  verificationStatus: {
    coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status', code: cond.verificationStatus }]
  },
  category: cond.category ? [{
    coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-category', code: cond.category }]
  }] : [],
  severity: cond.severity ? {
    coding: [{ code: cond.severity }], text: cond.severity
  } : undefined,
  code: {
    coding: [{ system: cond.code.system, code: cond.code.code, display: cond.code.display }],
    text: cond.code.display
  },
  subject: { reference: `Patient/${cond.patient?.fhirId || cond.patient}` },
  onsetDateTime: cond.onsetDate?.toISOString(),
  abatementDateTime: cond.abatementDate?.toISOString(),
  recordedDate: cond.recordedDate?.toISOString(),
  note: cond.note ? [{ text: cond.note }] : []
});

export const toFHIREncounter = (enc) => ({
  resourceType: 'Encounter',
  id: enc.fhirId,
  meta: { lastUpdated: enc.updatedAt },
  status: enc.status,
  class: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: enc.class?.code },
  type: enc.type?.map(t => ({
    coding: [{ system: t.system, code: t.code, display: t.display }]
  })) || [],
  subject: { reference: `Patient/${enc.patient?.fhirId || enc.patient}` },
  participant: enc.provider ? [{
    individual: { reference: `Practitioner/${enc.provider?.fhirId || enc.provider}` }
  }] : [],
  period: { start: enc.period?.start?.toISOString(), end: enc.period?.end?.toISOString() },
  reasonCode: enc.reasonCode?.map(r => ({
    coding: [{ system: r.system, code: r.code, display: r.display }]
  })) || []
});

export const toFHIRMedicationRequest = (med) => ({
  resourceType: 'MedicationRequest',
  id: med.fhirId,
  meta: { lastUpdated: med.updatedAt },
  status: med.status,
  intent: med.intent,
  medicationCodeableConcept: {
    coding: med.medication.rxnorm
      ? [{ system: 'http://www.nlm.nih.gov/research/umls/rxnorm', code: med.medication.rxnorm, display: med.medication.display }]
      : [{ display: med.medication.display }],
    text: med.medication.display
  },
  subject: { reference: `Patient/${med.patient?.fhirId || med.patient}` },
  authoredOn: med.authoredOn?.toISOString(),
  dosageInstruction: med.dosageInstruction?.map(d => ({
    text: d.text,
    route: d.route ? { coding: [{ code: d.route.code, display: d.route.display }] } : undefined,
    doseAndRate: d.doseQuantity ? [{
      doseQuantity: { value: d.doseQuantity.value, unit: d.doseQuantity.unit }
    }] : []
  })) || []
});

export const buildFHIRBundle = (resources, type = 'searchset') => ({
  resourceType: 'Bundle',
  type,
  total: resources.length,
  timestamp: new Date().toISOString(),
  entry: resources.map(r => ({ resource: r, fullUrl: `urn:uuid:${r.id}` }))
});
