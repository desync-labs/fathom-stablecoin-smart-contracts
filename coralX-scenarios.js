module.exports = {
  deployLocal: [
    ['compile'],
    ['execute', '--path', 'scripts/migrations/deployment', '--network', 'development']
  ],
  deployApothem: [
    ['compile'],
    ['execute', '--path', 'scripts/migrations/deployment', '--network', 'apothem']
  ],
  deployTokensLocal: [
    ['compile'],
    ['execute', '--path', 'scripts/migrations/collateral-tokens', '--network', 'development']
  ],
  deployTokensApothem: [
    ['compile'],
    ['execute', '--path', 'scripts/migrations/collateral-tokens', '--network', 'apothem']
  ],
  deployApothem: [
    ['execute', '--path', 'scripts/migrations/compliance-upgradability', '--network', 'apothem'],
    ['execute', '--path', 'scripts/migrations/tokens-creation-service', '--network', 'apothem'],
    ['execute', '--path', 'scripts/configurations/1_base_config.js', '--network', 'apothem'],
    ['execute', '--path', 'scripts/configurations/2_tokens_factory.js', '--network', 'apothem'],
    ['execute', '--path', 'scripts/custom/white-list-setup.js', '--network', 'apothem'],
  ],
  migrateAndConfigureForTests: [
    ['compile'],
    ['execute', '--path', 'scripts/migrations/tests'],
  ],
}
