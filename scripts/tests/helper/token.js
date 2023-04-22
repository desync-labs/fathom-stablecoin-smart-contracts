
async function approve(tokenAddress, spender, ammount) {
  const Token = await artifacts.initializeInterfaceAt("BEP20", tokenAddress);
  await Token.approve(spender, ammount);
  // console.log("approved");
}

module.exports = {approve}
