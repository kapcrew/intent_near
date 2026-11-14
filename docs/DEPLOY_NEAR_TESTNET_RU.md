# INTENT × NEAR Testnet — полный деплой (RU)

**Состояние архива:** исходный код + скрипты, **не задеплоено**. Никаких созданных мною в NEAR Testnet адресов, signed transactions или wasm-файлов здесь нет. Развёртывание требует твоих существующих NEAR Testnet-аккаунтов и подтверждений в NEAR CLI. Все адреса, которые появятся после деплоя, можно проверить через NEAR Blocks.

## 0. Что именно переехало с SKALE

Переиспользованы исходные 50 объектов, визуальная система INTENT (синий / светлый / тёмный), 117 организаций с интерактивной мировой картой, модель Living Property Passport и идеи управляемых агентов из `lineageProtocol`. **Не** переиспользованы EVM bytecode и wallet: NEAR не выполняет Solidity, `window.ethereum`, approve/transferFrom ERC-20 или SKALE x402. Вместо них три NEAR Rust/WASM контракта и кошелёк NEAR.

## 1. Установка на Mac / Ubuntu

```bash
node -v  # желательно 24.15+
# Если Node ниже 24.15, обновить через nvm:
nvm install 24
nvm use 24

# Rust (NEAR SDK 5.30.1 требует rustc >= 1.95)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source "$HOME/.cargo/env"
rustup update stable
rustup target add wasm32-unknown-unknown

# NEAR tooling — официальные установщики:
curl --proto '=https' --tlsv1.2 -LsSf https://github.com/near/cargo-near/releases/latest/download/cargo-near-installer.sh | sh
npm install -g near-cli-rs@latest

cargo --version
cargo near --help
near --help
```

Rust source находится в `contracts/property_registry/`, `contracts/property_cells/`, `contracts/agent_policy/`. Каждый контракт имеет собственный `Cargo.toml`, собирается независимо.

## 2. Создать отдельные Testnet-аккаунты

Требуется **4 аккаунта** минимум: один operator/owner и 3 отдельных аккаунта для хранения трёх WASM-контрактов. Создайте свои уникальные имена, не используйте литералы из примера. Для тестов агента нужны ещё account агент и account поставщик.

```bash
# Пример ФОРМЫ команды (НЕ использовать конкретное имя без замены):
near account create-account sponsor-by-faucet-service YOUR_OWNER.testnet autogenerate-new-keypair save-to-keychain network-config testnet create
near account create-account sponsor-by-faucet-service YOUR_REGISTRY.testnet autogenerate-new-keypair save-to-keychain network-config testnet create
near account create-account sponsor-by-faucet-service YOUR_SETTLEMENT.testnet autogenerate-new-keypair save-to-keychain network-config testnet create
near account create-account sponsor-by-faucet-service YOUR_POLICY.testnet autogenerate-new-keypair save-to-keychain network-config testnet create
```

Если аккаунты существуют, импортируй их **сам** через `near account import-account using-web-wallet network-config testnet` (или соответствующий CLI/keychain flow). Не помещай секреты в `.env`, GitHub или ZIP. Пополни Testnet-аккаунты через faucet; контрактам нужно достаточно тестовых NEAR для storage и газа. Faucet: https://near-faucet.io.

### Сконфигурировать IDs

```bash
cp .env.example .env
```

Заполни `.env` **реальными account IDs**, например:

```dotenv
OWNER_ID=your-owner.testnet
REGISTRY_ID=your-registry.testnet
SETTLEMENT_ID=your-settlement.testnet
POLICY_ID=your-policy.testnet
REVIEWER_ID=your-reviewer.testnet
AGENT_ID=your-agent.testnet
PROVIDER_ID=your-provider.testnet
```

Эти имена — placeholders, **не действующие записи в Testnet**. В `.env` храним только публичные IDs. Приватные ключи остаются в локальном keychain NEAR CLI. `.env` включен в `.gitignore`.

## 3. Сборка 3 разных контрактов

```bash
cd contracts/property_registry && cargo near build non-reproducible-wasm --no-abi && cd ../..
cd contracts/property_cells && cargo near build non-reproducible-wasm --no-abi && cd ../..
cd contracts/agent_policy && cargo near build non-reproducible-wasm --no-abi && cd ../..
```

На выходе ожидаются:

```text
contracts/property_registry/target/near/property_registry.wasm
contracts/property_cells/target/near/property_cells.wasm
contracts/agent_policy/target/near/agent_policy.wasm
```

Вместо трёх отдельных команд можно сразу запустить полный деплой из шага 4: скрипт сам соберёт код.

## 4. СДЕЛАТЬ РЕАЛЬНЫЙ DEPLOY ON NEAR TESTNET

Автоматически — из корневой папки репозитория:

```bash
npm run deploy:near
```

Скрипт `scripts/deploy-testnet.mjs` строго по очереди соберёт Rust/WASM, вызовет `near contract deploy ... with-init-call new` для каждого контрактного аккаунта, инициирует owner/treasury и обновит `web/public/deployments.json`. Каждая операция подпишется через keychain. **При ошибке скрипт останавливается**, не продолжает и не пишет ложные contract IDs. Предварительно требуются созданные Testnet аккаунты и рабочие NEAR CLI credentials. Не запускай повторно на уже инициализированных контрактах: `new` повторно выполнять нельзя. Для обновлений отдельно деплой WASM `without-init-call` после анализа сохранения state schema.

Эквивалент одной операции вручную (пример для registry):

```bash
near contract deploy "$REGISTRY_ID" \
  use-file contracts/property_registry/target/near/property_registry.wasm \
  with-init-call new json-args "{\"owner\":\"$OWNER_ID\"}" \
  prepaid-gas '100 Tgas' attached-deposit '0 NEAR' \
  network-config testnet sign-with-keychain send
```

Для `property_cells` используются параметры `{"owner":"...","treasury":"..."}`; для `agent_policy` — `{"owner":"..."}`. Owner в init определяется твоим `OWNER_ID`; отдельные accounts для контрактов подписывают их загрузку.

## 5. Заполнить 8 демонстрационных onchain listings

```bash
npm run seed:near
```

`seed-testnet.mjs` берёт **первые 8** отмеченных `nearEnabled` объектов из каталога, для каждого делает `get_property` / `get_listing` и при отсутствии вызывает `register_property` и `configure_listing`. Цена каждой синтетической Cell `0.01` тестовых NEAR, supply 1000. Поскольку регистрация от владельца не равна human approval, все новые объекты получают статус `PENDING`. Повторный seed на тех же объектах пропускает существующие записи.

Полное подтверждение:

```bash
npm run smoke:near
```

Эта проверка делает 6 JSON-RPC `view` запросов к реальным контрактам. Состояние `PASS` означает, что `get_*` работает на указанном ID. Проверяй адреса и транзакции дополнительно через https://testnet.nearblocks.io.

## 6. Запустить web-приложение

```bash
npm run web:install
npm run web:dev
# http://localhost:4173
```

Открой **Discover**: каталог из 50 объектов; **Partners**: карта 117 организаций. На **Settlement** выбери один из 8 посеянных onchain listings, подключи MyNearWallet/Testnet и купи Cell. Посмотри в **Portfolio** реальный Cell balance.

Внимание: MyNearWallet — отдельный NEAR wallet, а не MetaMask. Кошелёк может возвращаться redirect-ом: после завершения подписи нажми Refresh и проверь на explorer. Для записи в разные контракты wallet может запросить дополнительное разрешение; owner flow доступен также через near-cli.

Для статического хостинга:

```bash
npm run web:build
# web/dist/ содержит index.html, ресурсы, production JS и deployments.json.
# Раздать на корне домена (например, nginx / Cloudflare Pages / Netlify).
```

`python3 -m http.server 8080 --directory preview-dist` запускает **только read-only визуальную версию**, не wallet app. Не используй preview для blockchain demo.

## 7. Human Review (реальный Testnet tx)

Владелец добавляет reviewer:

```bash
near contract call-function as-transaction "$REGISTRY_ID" set_reviewer json-args "{\"account_id\":\"$REVIEWER_ID\",\"enabled\":true}" prepaid-gas '100 Tgas' attached-deposit '0 NEAR' sign-as "$OWNER_ID" network-config testnet sign-with-keychain send
```

После этого reviewer может зафиксировать решение по property #1. `note_hash` — 64 hex символа SHA-256 произвольной записки. Получить хеш в Node:

```bash
node -e "console.log(require('node:crypto').createHash('sha256').update('Human review approved for testnet').digest('hex'))"
```

Далее используйте форму **Passport** из браузера под reviewer wallet либо CLI:

```bash
near contract call-function as-transaction "$REGISTRY_ID" review_property json-args '{"property_id":1,"approved":true,"note_hash":"REPLACE_WITH_64_CHAR_SHA256_HEX"}' prepaid-gas '100 Tgas' attached-deposit '0 NEAR' sign-as "$REVIEWER_ID" network-config testnet sign-with-keychain send
```

Проверить `get_property {"property_id":1}`. Аналогично `append_evidence` добавляет неизменяемую историю хешей `Valuation`, `Compliance`, `Inspection` и т.д.

## 8. Сценарий agent → provider с реальным Testnet NEAR

1. Заведи отдельный funded account для агента (`AGENT_ID`) и поставщика (`PROVIDER_ID`).
2. Под owner wallet через **Agent Operations** вызови `configure_agent(AGENT_ID, max_per_action_yocto=0.01 NEAR, daily_budget_yocto=0.1 NEAR, policy_hash=SHA256(policy))`.
3. Owner вызывает `set_provider(agent_id=AGENT_ID, provider_id=PROVIDER_ID, allowed=true)`.
4. Под wallet агента вызови `execute_payment(provider_id=PROVIDER_ID, property_id=1, action_hash=SHA256(request), amount_yocto=0.001 NEAR)` **с точно таким же attached deposit**.
5. Проверить `get_receipts(AGENT_ID)` / `get_recent_receipts()`; после asynchronous callback receipt становится `COMPLETED` либо `FAILED`.
6. Негативные тесты: неразрешённый provider, превышение дневного лимита, экстренная заморозка (`set_global_freeze(true)`) — платеж должен быть отклонён. Проверка блокировок не расходует средства на provider, но gas транзакции может списаться.

AgentPolicy не выводит NEAR с кошелька owner и не подписывает транзакции автоматически от его имени. Агент сам подтверждает переводы со своего Testnet аккаунта. Для server-side autonomous agent нужен отдельный защищённый signer / function-call key и его ограничение — в данный архи́в ключи не включены.

## 9. Проверить реальное выполнение

```bash
near contract call-function as-read-only "$REGISTRY_ID" get_property json-args '{"property_id":1}' network-config testnet now
near contract call-function as-read-only "$REGISTRY_ID" get_evidence json-args '{"property_id":1}' network-config testnet now
near contract call-function as-read-only "$SETTLEMENT_ID" get_holding json-args "{\"property_id\":1,\"account_id\":\"$OWNER_ID\"}" network-config testnet now
near contract call-function as-read-only "$POLICY_ID" get_recent_receipts json-args '{}' network-config testnet now
```

## 10. Ошибки и решения

- `cargo: command not found`: не установлен Rust; `source ~/.cargo/env`.
- `cargo near` отсутствует: установить cargo-near, проверить PATH.
- `Rust 1.95 required`: обновить stable через `rustup update stable`.
- `no access key / authorization`: аккаунт должен быть создан, ключ доступен в CLI/keychain; ключ контрактного аккаунта нужен для WASM deploy.
- `account does not exist`: не выдумывать ID в `.env`; создать реальные Testnet accounts.
- `Contract should be initialized`: ошибочная повторная инициализация; для обновления кода нужен `without-init-call` после проверки storage compatibility.
- `Not enough balance`: Testnet faucet и funding на storage/gas.
- `Reviewer role required` / `Owner only`: переключиться на соответствующий NEAR signer.
- `Attach exact testnet NEAR amount`: количество * цена listing в yocto; frontend считает и прикрепляет сумму автоматически.
- `Provider not allowlisted`: owner должен вызвать `set_provider` до agent payment.
- `wallet connected but cannot sign another contract`: Wallet Selector ограниченный function-call key — одобрите новый запрос в кошельке либо выполните owner flow из NEAR CLI.
- `NEAR Intents` swap на Testnet: нет такой сети для NEAR Intents; не пытайся выдавать интеграцию с основным протоколом за testnet-версию.

## 11. Перед заявкой на хакатон

После успешных деплоя, smoke check и минимум двух записанных транзакций в Testnet: открыть публичный GitHub, снять видео «register/review → buy → onchain holding → agent policy/freeze», сделать публичный пост в X с `@NEARProtocol` + `#NEARHackathon`, отправить **одну** заявку по https://nearhackathon.com/#apply до 14 ноября 2026 года 23:59 UTC. Обязательно указать, что исходный продукт существовал до хакатона, а NEAR-контракты и интеграции — новое расширение. Мейннет-кошелёк в заявке может использоваться **для выплаты**, а тестнет-адреса — для работающего прототипа.
