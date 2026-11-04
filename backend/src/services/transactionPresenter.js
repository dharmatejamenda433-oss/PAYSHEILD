function presentParty(party) {
  if (!party) return null;

  if (party.name !== undefined) {
    return {
      id: (party._id || party.id || '').toString(),
      name: party.name,
      email: party.email,
    };
  }

  return { id: party.toString(), name: null, email: null };
}

function toId(value) {
  if (!value) return null;
  return (value._id || value.id || value).toString();
}

/**
 * Builds the public API representation of a transaction.
 * `direction` is relative to the authenticated viewer.
 */
export function presentTransaction(transaction, viewerId = null) {
  const sender = presentParty(transaction.senderId);
  const receiver = presentParty(transaction.receiverId);
  const reviewer = transaction.reviewedBy
    ? presentParty(transaction.reviewedBy)
    : null;

  let direction = 'ADMIN';
  if (viewerId) {
    if (sender && String(viewerId) === sender.id) direction = 'OUTGOING';
    else if (receiver && String(viewerId) === receiver.id) direction = 'INCOMING';
    else direction = 'ADMIN';
  }

  return {
    id: toId(transaction),
    transactionId: transaction.transactionId,
    amount: transaction.amount,
    currency: transaction.currency,
    description: transaction.description || '',
    status: transaction.status,
    decision: transaction.decision,
    riskScore: transaction.riskScore,
    riskLevel: transaction.riskLevel,
    riskReasons: transaction.riskReasons || [],
    mlProbability: transaction.mlProbability,
    mlAvailable: transaction.mlAvailable,
    mlModel: transaction.mlModel,
    sender,
    receiver,
    direction,
    clientLocation: transaction.clientLocation || null,
    reviewedBy: reviewer,
    reviewedAt: transaction.reviewedAt || null,
    reviewReason: transaction.reviewReason || null,
    completedAt: transaction.completedAt || null,
    declinedAt: transaction.declinedAt || null,
    failureReason: transaction.failureReason || null,
    createdAt: transaction.createdAt,
    updatedAt: transaction.updatedAt,
  };
}

export function presentAlert(alert, transaction = null) {
  return {
    id: toId(alert),
    transactionId: transaction ? transaction.transactionId : alert.transactionId,
    riskScore: alert.riskScore,
    riskLevel: alert.riskLevel,
    reasons: alert.reasons || [],
    status: alert.status,
    resolutionNote: alert.resolutionNote || null,
    resolvedAt: alert.resolvedAt || null,
    createdAt: alert.createdAt,
    transaction: transaction ? presentTransaction(transaction) : undefined,
  };
}
