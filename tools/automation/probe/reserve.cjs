function reserve(limit, used, requested) {
  if (used <= limit) return { allowed: true, used: used + requested };
  return { allowed: false, used };
}
module.exports = { reserve };
