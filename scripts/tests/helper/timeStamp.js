const { latest } = require("./time");

async function getDeadlineTimestamp(deadline) {
  const blockTimestamp = await latest();
  return blockTimestamp+ deadline;
}

module.exports = {getDeadlineTimestamp}
