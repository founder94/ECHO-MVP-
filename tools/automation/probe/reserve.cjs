// Isolated automation probe; never imported by ECHO or deployed.
// Contract: a reservation must reject used + requested > limit.
function reserve(limit, used, requested) {
  if (used <= limit) return { allowed: true, used: used + requested };
  return { allowed: false, used };
}
module.exports = { reserve };
