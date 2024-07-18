module.exports = {
  deployLocal: [
    ['execute', '--path', 'scripts/migrations/deployment', '--network', 'development'],
    ['execute', '--path', 'scripts/migrations/configuration', '--network', 'development']
  ],
  deployMainnet: [
    ['execute', '--path', 'scripts/migrations/deployment', '--network', 'mainnet'],
    ['execute', '--path', 'scripts/migrations/configuration', '--network', 'mainnet']
  ],
  deployApothem: [
    ['execute', '--path', 'scripts/migrations/deployment', '--network', 'apothem'],
    ['execute', '--path', 'scripts/migrations/configuration', '--network', 'apothem']
  ],
  deploySepolia: [
    ['execute', '--path', 'scripts/migrations/deployment-continue', '--network', 'sepolia'],
    ['execute', '--path', 'scripts/migrations/configuration', '--network', 'sepolia']
  ],
  deployFantom: [
    ['execute', '--path', 'scripts/migrations/deployment', '--network', 'fantom'],
    ['execute', '--path', 'scripts/migrations/configuration', '--network', 'fantom']
  ],
  addCollateralLocal: [
    ['execute', '--path', 'scripts/migrations/add-collateral/deployment', '--network', 'development'],
    ['execute', '--path', 'scripts/migrations/add-collateral/configuration', '--network', 'development']
  ],
  addCollateralApothem: [
    ['execute', '--path', 'scripts/migrations/add-collateral/deployment', '--network', 'apothem'],
    ['execute', '--path', 'scripts/migrations/add-collateral/configuration', '--network', 'apothem']
  ],
  addCollateralMainnet: [
    ['execute', '--path', 'scripts/migrations/add-collateral/deployment', '--network', 'mainnet'],
    ['execute', '--path', 'scripts/migrations/add-collateral/configuration', '--network', 'mainnet']
  ],
  switchPriceFeedLocal: [
    ['execute', '--path', 'scripts/migrations/priceFeed', '--network', 'development'],
  ],
  whitelistCollateralTokenAdapterLocal: [
    ['execute', '--path', 'scripts/whitelist/collateral-adapter/1_whitelisting.js', '--network', 'development']
  ],
  removeFromWLCollateralTokenAdapterLocal: [
    ['execute', '--path', 'scripts/whitelist/collateral-adapter/2_removeFromWL.js', '--network', 'development']
  ],
  whitelistFMMLocal: [
    ['execute', '--path', 'scripts/whitelist/FMM/1_fmm-whitelisting.js', '--network', 'development']
  ],
  addRolesLocal: [
    ['execute', '--path', 'scripts/roles/addRoles', '--network', 'development']
  ],
  revokeRolesLocal: [
    ['execute', '--path', 'scripts/roles/revokeRoles', '--network', 'development']
  ],
  transferProtocolOwnershipLocal: [
    ['execute', '--path', 'scripts/ownership/protocol-ownership-transfer', '--network', 'development']
  ],
  transferProxyAdminOwnershipLocal: [
    ['execute', '--path', 'scripts/ownership/proxy-admin-ownership-transfer', '--network', 'development']
  ],
  feeCollectionLocal: [
    ['execute', '--path', 'scripts/migrations/fee-collection', '--network', 'development']
  ],
  deployTokensLocal: [
    ['execute', '--path', 'scripts/migrations/collateral-tokens', '--network', 'development']
  ],
  deployTokensApothem: [
    ['execute', '--path', 'scripts/migrations/collateral-tokens', '--network', 'apothem']
  ],

  migrateAndConfigureForTests: [
    ['compile'],
    ['execute', '--path', 'scripts/migrations/test/pre-deployment'],
    ['execute', '--path', 'scripts/migrations/deployment'],
    ['execute', '--path', 'scripts/migrations/test/configuration'],
    ['execute', '--path', 'scripts/migrations/test/post-deployment'],
    // add new collateral flow
    ['execute', '--path', 'scripts/migrations/test/add-collateral/pre-deployment'],
    ['execute', '--path', 'scripts/migrations/add-collateral/deployment'],
    ['execute', '--path', 'scripts/migrations/test/add-collateral/configuration'],
  ],
}
