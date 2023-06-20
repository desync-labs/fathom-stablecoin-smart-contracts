module.exports = {
  deployLocal: [
    ['execute', '--path', 'scripts/migrations/deployment', '--network', 'development'],
    ['execute', '--path', 'scripts/migrations/configuration', '--network', 'development']
  ],
  deployApothem: [
    ['execute', '--path', 'scripts/migrations/deployment', '--network', 'apothem'],
    ['execute', '--path', 'scripts/migrations/configuration', '--network', 'apothem']
  ],
  addCollateralLocal: [
    ['execute', '--path', 'scripts/migrations/add-collateral/deployment', '--network', 'development'],
    ['execute', '--path', 'scripts/migrations/add-collateral/configuration', '--network', 'development']
  ],
  addCollateralApothem: [
    ['execute', '--path', 'scripts/migrations/add-collateral/deployment', '--network', 'apothem'],
    ['execute', '--path', 'scripts/migrations/add-collateral/configuration', '--network', 'apothem']

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
    ['execute', '--path', 'scripts/migrations/test/add-collateral/configuration']
  ],
}
