const { getDeadlineTimestamp } = require("../tests/helper/timeStamp");
const { getContract } = require("../tests/helper/contracts");
const { approve } = require("../tests/helper/token");


//1)approve
//2)Include DEX Router Interface to the codebase, so that the contract can be instantiated.
//3)swap.

describe("Swap tokens on dex", async () => {
  
    let mockToken0 = "0xce75A95160D96F5388437993aB5825F322426E04"; // <- some address from Remix
    let mockToken1 = "0x0D2B0406bc8400E61f7507bDed415c98E54A8b11"; // <- some address from Remix
    let routerAddress = "0xf72f1a39ae0736Ef6A532605C85aFB0A4E349714"; // DEX Router Address

    const Router = await artifacts.initializeInterfaceAt("IUniswapV2Router01", routerAddress);

  
    beforeEach(async () => {
      await snapshot.revertToSnapshot();

      //approve
      await approve(mockToken0, routerAddress, 200000);
      await approve(mockToken1, routerAddress, 200000);
    })
  
    describe("Swap tokens on DEX", () => {
      it("Swap", async () => {
        //spending mockToken0 to receive mockToken1. The amount of mockToken0 to spend is fixed but mockToken1 amount should be more than 200, otherwise refault.
        await Router.swapExactTokensForTokens(100, 200, [mockToken0, mockToken1], "0x4C5F0f90a2D4b518aFba11E22AC9b8F6B031d204", await getDeadlineTimestamp(10000));
      });

    });
  });
