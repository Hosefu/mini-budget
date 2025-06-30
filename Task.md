### Обновляем MVP под **TypeScript + Express + React**

> **Правило 50 / 50**
> *Экономим и ведём взаиморасчёт:* доля расходов каждого = 50 % суммы покупки, независимо от того, кто фактически заплатил. Поэтому нужно хранить **«кто внёс»** и **«сколько должен был»**, а сальдо выводить автоматически.

---

## 1. Архитектура ― один репозиторий, два подпроекта

```
family-budget/
├─ server/         ← Express API + SQLite (≈ 250 LoC TS)
│  ├─ src/
│  │   ├─ db.ts        (инициализация better-sqlite3)
│  │   ├─ models.ts    (schema + миграция)
│  │   ├─ routes.ts    (REST)
│  │   ├─ ai.ts        (вызов OpenAI)
│  │   └─ index.ts     (Express + cookie-session)
│  └─ Dockerfile
├─ web/            ← Vite + React (≈ 300 LoC TSX/JS)
│  ├─ src/pages/    (4 страницы: Login, Scan, Payments, Categories)
│  ├─ src/components/  (QrScanner, PaymentTable, DoughnutChart)
│  └─ vite.config.ts
└─ docker-compose.yml
```

* **БД** — SQLite через `better-sqlite3` (zero-dep native driver, отличный для serverless) ([stackoverflow.com][1])
* **QR-сканер** — `html5-qrcode` в React компоненте ([github.com][2])
* **Чек из ФНС** — пакет `fns-api` (есть методы `addReceiptQR` / `getReceipt`) ([npmjs.com][3])
* **API-сервер** — чистый Express + `cookie-session` + `zod` для валидации
* **OpenAI** — `openai` SDK (Node) для автокатегоризации позиций
* **Статика** — после `vite build` React кладётся в `server/public`; Express раздаёт SPA.
* **Деплой** — один Docker-контейнер (спереди можно поставить Caddy/Nginx для TLS).

---

## 2. Схема данных (SQLite)

```ts
// models.ts
export const init = db => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS category (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      color TEXT DEFAULT '#cccccc',
      monthly_limit INTEGER
    );

    CREATE TABLE IF NOT EXISTS payment (
      id INTEGER PRIMARY KEY,
      ts TEXT DEFAULT CURRENT_TIMESTAMP,
      total INTEGER NOT NULL,
      paid_egor INTEGER DEFAULT 0,
      paid_syoma INTEGER DEFAULT 0,
      raw_qr TEXT,
      fns_payload TEXT
    );

    CREATE TABLE IF NOT EXISTS item (
      id INTEGER PRIMARY KEY,
      payment_id INTEGER REFERENCES payment(id) ON DELETE CASCADE,
      name TEXT,
      qty REAL,
      price INTEGER,
      category_id INTEGER REFERENCES category(id)
    );
  `);
};
```

*Вся логика 50 / 50 сводится к этим двум числам:*

```
net_egor  = Σ(paid_egor  – total/2)
net_syoma = Σ(paid_syoma – total/2) = –net_egor
```

Запрос баланса:

```sql
SELECT
  SUM(paid_egor  - total/2) AS egor_delta,
  SUM(paid_syoma - total/2) AS syoma_delta
FROM payment;
```

---

## 3. REST-эндпойнты

| Метод                 | URL                                                       | Что делает |
| --------------------- | --------------------------------------------------------- | ---------- |
| `POST /auth`          | PIN ⇒ cookie-session (\`role = 'egor'                     | 'syoma'\`) |
| `POST /qr`            | `{qr}` ⇒ `payment` *async* добавляет чек                  |            |
| `POST /payment`       | ручной ввод (`total`, `paidEgor`, `paidSyoma`, `items[]`) |            |
| `PATCH /payment/:id`  | корректировка сумм/категорий                              |            |
| `DELETE /payment/:id` | удалить платёж                                            |            |
| `GET /payments`       | лента + фильтры (дата, категория)                         |            |
| `GET /balance`        | текущее сальдо                                            |            |
| `GET /categories`     | список                                                    |            |
| `POST /categories`    | создать/редактировать/удалить                             |            |
| `POST /ai/classify`   | {items\[]} ⇒ AI ⇒ `{itemId: categoryId}`                  |            |

> Весь API укладывается в `routes.ts` около \~120 строк.

---

## 4. React-фронт (Vite)

1. **LoginPage** – форма PIN, POST → `/auth`, redirect на `/payments`.
2. **ScanPage** – компонент `QrScanner` (html5-qrcode), при успешном скане POST `/qr` и всплывающее «чек в обработке».
3. **PaymentsPage**

   * Таблица `PaymentTable` (HTMX не нужен; используем SWR/fetch).
   * Столбцы: дата, сумма, paid by, auto-категории, кнопка «✏».
   * В шапке – дроп-даун фильтров + индикатор *Balance: +420 ₽* (зел/красн).
4. **CategoriesPage** – CRUD, цвет выбирается `<input type=color>`.
5. **DoughnutChart** (Chart.js) на дашборде: траты vs лимиты.

> Вся логика состояния – **tanstack/query**; UI – **MUI 5** или чистый CSS, чтобы не тащить большие либы.

---

## 5. Алгоритм «Чек → Категории»

```ts
// ai.ts
import OpenAI from "openai";
export async function classify(items, categories) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const res = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: "У тебя категории: " + JSON.stringify(categories) },
      { role: "user",   content: JSON.stringify(items) }
    ],
    response_format: { type: "json_object" }
  });
  return JSON.parse(res.choices[0].message.content); // {itemId: categoryId}
}
```

*Вызывается после того, как `fns-api` вернул расшифровку чека;
до UI доходит уже «крашеный» список позиций.*

---

## 6. Авторизация «двумя пин-кодами»

```ts
// index.ts
app.post("/auth", (req, res) => {
  const { pin } = req.body;
  const role = pin === "1329" ? "egor" : pin === "3415" ? "syoma" : null;
  if (!role) return res.status(401).end();
  req.session!.role = role;
  res.end();
});
```

Cookie живёт 30 дней, https-only, SameSite=Lax. Этого достаточно для «только мы вдвоём».

---

## 7. Деплой one-shot

```bash
# единая сборка
docker compose up -d --build
```

`docker-compose.yml`

```yaml
services:
  app:
    build: ./server        # собирает TS → node:18-slim
    environment:
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - FNS_LOGIN=${FNS_LOGIN}
      - FNS_PASSWORD=${FNS_PASSWORD}
    volumes:
      - ./data:/app/data   # db.sqlite хранится здесь
    ports:
      - "80:3000"
```

*React* собирается командой `npm run build` (Vite) внутри `Dockerfile`, так что на выходе один контейнер. Если нужен TLS — добавьте Caddy в тот же compose.

---

## 8. Пример количества строк

| Файл/папка           | ≈ Строк                                                    |
| -------------------- | ---------------------------------------------------------- |
| `server/src/*.ts`    | 250                                                        |
| `web/src/*.tsx`      | 300                                                        |
| `Dockerfile+compose` | 25                                                         |
| **Всего**            | **≈ 575** (в два раза меньше, чем классический full-stack) |

---

## 9. Как начать

1. Создайте `.env` с ключами OpenAI и учёткой ФНС.
2. `docker compose up`.
3. Откройте `https://<domain>/` → введите PIN → «Сканировать чек».
4. Покупки разложатся, баланс пересчитается, а вы увидите круговую диаграмму лимитов.

**Минимум кода — максимум пользы.** Если что-то хочется упростить ещё сильнее (например, убрать React и оставить HTMX), можно, но даже с React проект остаётся < 600 строк и деплоится одной командой.

---

### Полезные ссылки

* `html5-qrcode` React-пример ([github.com][2])
* Node + SQLite Express туториал ([geshan.com.np][4])
* NPM-пакет для работы с ФНС QR-чеками ([npmjs.com][3])

[1]: https://stackoverflow.com/questions/66930477/how-to-correctly-and-fully-import-bettersqlite3s-database-class-in-typescript?utm_source=chatgpt.com "How to correctly and fully import BetterSqlite3's Database class in ..."
[2]: https://github.com/scanapp-org/html5-qrcode-react?utm_source=chatgpt.com "GitHub - scanapp-org/html5-qrcode-react: React example using html5 ..."
[3]: https://www.npmjs.com/package/fns-api?utm_source=chatgpt.com "fns-api - npm"
[4]: https://geshan.com.np/blog/2021/10/nodejs-sqlite/?utm_source=chatgpt.com "Node.js SQLite: Build a simple REST API with Express step-by-step"
