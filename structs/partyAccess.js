function memberFor(party, accountId) {
  return party?.members?.find((member) => member.account_id === accountId) || null;
}

function isPartyMember(party, accountId) {
  return Boolean(memberFor(party, accountId));
}

function isPartyCaptain(party, accountId) {
  return memberFor(party, accountId)?.role === "CAPTAIN";
}

function hasPartyInvite(party, accountId) {
  return (party?.invites || []).some(
    (invite) => invite.invitee_id === accountId && invite.status === "SENT"
  );
}

function canViewParty(party, accountId) {
  return isPartyMember(party, accountId) || hasPartyInvite(party, accountId);
}

function canJoinParty(party, accountId, currentPartyId = null) {
  if (!party || !accountId) return { ok: false, reason: "invalid" };
  if (isPartyMember(party, accountId)) return { ok: true, alreadyMember: true };
  if (currentPartyId && currentPartyId !== party.id) {
    return { ok: false, reason: "already_in_party" };
  }
  const accepting = party.meta?.["urn:epic:cfg:accepting-members_b"] !== "false";
  if (!accepting) return { ok: false, reason: "party_closed" };
  const maxSize = Math.max(1, Number(party.config?.max_size) || 16);
  if ((party.members || []).length >= maxSize) {
    return { ok: false, reason: "party_full" };
  }
  const joinability = String(party.config?.joinability || "OPEN").toUpperCase();
  if (joinability !== "OPEN" && !hasPartyInvite(party, accountId)) {
    return { ok: false, reason: "invite_required" };
  }
  return { ok: true };
}

function canInviteToParty(party, accountId, inviteeId) {
  if (!isPartyMember(party, accountId)) return { ok: false, reason: "not_member" };
  if (!inviteeId || inviteeId === accountId) return { ok: false, reason: "invalid_invitee" };
  if (isPartyMember(party, inviteeId)) return { ok: false, reason: "already_member" };
  const maxSize = Math.max(1, Number(party.config?.max_size) || 16);
  if ((party.members || []).length >= maxSize) return { ok: false, reason: "party_full" };
  return { ok: true };
}

function canRemovePartyMember(party, actorId, targetId) {
  if (!isPartyMember(party, actorId) || !isPartyMember(party, targetId)) {
    return { ok: false, reason: "not_member" };
  }
  if (actorId === targetId || isPartyCaptain(party, actorId)) return { ok: true };
  return { ok: false, reason: "captain_required" };
}

function canUpdateParty(party, actorId) {
  if (!isPartyCaptain(party, actorId)) return { ok: false, reason: "captain_required" };
  return { ok: true };
}

module.exports = {
  memberFor,
  isPartyMember,
  isPartyCaptain,
  hasPartyInvite,
  canViewParty,
  canJoinParty,
  canInviteToParty,
  canRemovePartyMember,
  canUpdateParty,
};
