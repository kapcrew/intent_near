# INTENT NEAR — минимальный патч Meteor Wallet

Этот ZIP предназначен **только** для ранее полученного проекта `INTENT_NEAR_TESTNET_HACKATHON_FULL.zip`.

## Заменить два файла

- `web/src/main.js` — поменял MyNearWallet на Meteor Wallet.
- `web/package.json` — поменял зависимость Wallet Selector на `@near-wallet-selector/meteor-wallet`.

Распаковать ZIP **в корень уже существующей папки проекта** (ту, где лежит корневой `package.json`), с заменой одноименных файлов и с сохранением структуры папок. Не создавайте еще один каталог с вложенным старым проектом.

**Не заменяйте** `.env`, `contracts/`, `web/public/properties.json`, `web/public/partners-data.js` и данные хранилища. Подлинные ключи не включены.

После копирования запустите из корня проекта:

```bash
npm run web:install
npm run check
```

Далее, когда Rust, Cargo и cargo-near установлены и три аккаунта действительно созданы, выполните:

```bash
npm run deploy:near
npm run seed:near
npm run smoke:near
npm run web:dev
```

ВАЖНО: `deploy:near` включает инициализацию `new` и предназначен для свежих аккаунтов. Если уже был частичный успешный деплой, не повторяйте автоматически всю команду. Проверьте, что именно было развернуто.
