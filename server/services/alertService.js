/**
 * Real-time alert/notification service.
 * Pushes care gap and clinical alerts via Socket.io.
 */
let _io = null;

export const setSocketIO = (io) => { _io = io; };

export const emitToOrg = (orgId, event, payload) => {
  if (!_io) return;
  _io.to(`org:${orgId}`).emit(event, { ...payload, timestamp: new Date().toISOString() });
};

export const emitCareGapAlert = (orgId, patientId, gap) => {
  emitToOrg(orgId, 'care_gap_alert', {
    type: 'CARE_GAP',
    patientId,
    gap: { id: gap.id, name: gap.name, priority: gap.priority }
  });
};

export const emitHighRiskAlert = (orgId, patient) => {
  emitToOrg(orgId, 'high_risk_patient', {
    type: 'HIGH_RISK',
    patientId: patient._id,
    patientName: [patient.name?.[0]?.given?.join(' '), patient.name?.[0]?.family].filter(Boolean).join(' '),
    riskScore: patient.riskScore?.value,
    riskCategory: patient.riskScore?.category,
    factors: patient.riskScore?.factors
  });
};

export const emitPipelineEvent = (orgId, pipelineId, event, stats) => {
  emitToOrg(orgId, 'pipeline_event', {
    type: event,
    pipelineId,
    stats
  });
};

export const emitDataQualityAlert = (orgId, resourceType, resourceId, flags) => {
  const errors = flags.filter(f => f.severity === 'error');
  if (!errors.length) return;
  emitToOrg(orgId, 'data_quality_alert', {
    type: 'DATA_QUALITY',
    resourceType, resourceId,
    errorCount: errors.length,
    flags: errors.slice(0, 5)
  });
};
