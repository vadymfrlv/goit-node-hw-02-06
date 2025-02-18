Створений аккаунт на [MongoDB Atlas](https://www.mongodb.com/cloud/atlas). Через Compass створена
база даних `db-app` і в ній колекція з `contacts` та `users`. Написаний код для створення
підключення до MongoDB за допомогою [Mongoose](https://mongoosejs.com/).

Схема моделі колекції `contacts`:

```js
  {
    name: {
      type: String,
      required: [true, 'Set name for contact'],
    },
    email: {
      type: String,
      unique: true,
    },
    phone: {
      type: String,
      required: [true, 'Set phone for contact'],
      unique: true,
    },
    favorite: {
      type: Boolean,
      default: false,
    },
    owner: {
      type: Schema.Types.ObjectId,
      ref: 'user',
      required: true,
    },
  },
  { versionKey: false, timestamps: true }
```

Схема моделі колекції `users`.

```js
  {
    name: {
      type: String,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      match: emailRegEx,
      unique: true,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      match: passwordRegEx,
    },
    subscription: {
      type: String,
      enum: ['starter', 'pro', 'business'],
      default: 'starter',
    },
    avatarURL: {
      type: String,
      required: true,
    },
    token: {
      type: String,
      default: '',
    },
    verify: {
      type: Boolean,
      default: false,
    },
    verificationToken: {
      type: String,
      required: [true, 'Verify token is required'],
    },
  },
  { versionKey: false, timestamps: true }
```

Схема контактів зроблена так що кожен користувач бачив тільки свої контакти. Для цього в схемі
контактів додана властивість

```js
    owner: {
      type: Schema.Types.ObjectId,
      ref: 'user',
    }
```

У схему користувача додано властивість `avatarURL` для зберігання зображення.

```shell
{
  ...
  avatarURL: String,
  ...
}
```

У схему користувача додано властивісті `verificationToken` і `verify`. Значення поля `verify` рівне
`false` означатиме, що його email ще не пройшов верифікацію

```js
{
  verify: {
    type: Boolean,
    default: false,
  },
  verificationToken: {
    type: String,
    required: [true, 'Verify token is required'],
  },
}
```

Додана верифікацію email користувача після реєстрації за допомогою сервісу
[SendGrid](https://sendgrid.com/) А також використаний пакет
[gravatar](https://www.npmjs.com/package/gravatar) для того, щоб при реєстрації нового користувача
відразу згенерувати йому аватар по його `email`.

# REST API підтримує такі раути для `users` 👤 :

### Реєстрація @ POST /api/users/register

- Зроблена валідація всіх обов'язкових полів (email і password). При помилці валідації повертає
  помилку валідації.
- У разі успішної валідації в моделі `User` створює користувача за даними, які пройшли валідацію.
  Для засолювання паролів використанний [bcryptjs](https://www.npmjs.com/package/bcryptjs)
- Якщо пошта вже використовується кимось іншим, повертає помилку Conflict.
- В іншому випадку повертає успішну відповідь.
- Створює посилання на аватарку користувача за допомогою
  [gravatar](https://www.npmjs.com/package/gravatar)
- Отриманий URL зберігає в поле `avatarURL` під час створення користувача.

- Створюється `verificationToken` для користувача і записує його у БД (для генерації токена
  використовується пакет [shortid](https://www.npmjs.com/package/shortid)
- Відправяється email на пошту користувача і вказується посилання для верифікації email (
  `/users/verify/:verificationToken`) в повідомленні.
- Також враховано що логін користувача не дозволений, якщо не верифікувано email.

- Після реєстрації, користувач отримає лист на вказану при реєстрації пошту з посиланням для
  верифікації свого email.
- Пройшовши по посиланню в отриманому листі, в перший раз, користувач отримає відповідь Verification
  successful, що має на увазі успішну верифікацію email.
- Пройшовши по посиланню повторно користувач отримає помилку User not found.

### Верифікації email @ POST /api/users/verify/:verificationToken

- За параметром `verificationToken` відбуваеться пошук користувача в моделі `User`
- Якщо користувач з таким токеном не знайдений, повертає помилку 'Not Found'.
- Якщо користувач знайдений - встановлює `verificationToken` в `null`, а поле `verify` в `true` в
  документі користувача і повертає успішну відповідь.

### Повторна відправка email з посиланням для верифікації email @ POST /api/users/verify

- Було передбачено умову якщо користувач випадково видалив лист для верифікації email; або воно може
  не дійти з якоїсь причини до адресата; або сервіс відправки листів під час реєстрації видав
  помилку і т.д.
- Отримує `body` у форматі `{email}`.
- Якщо в `body` немає обов'язкового поля `email`, повертає json з ключем
  `{"message":"missing required field email"}` і статусом `400`.
- Якщо з `body` все добре, виконуємо повторну відправку листа з `verificationToken` на вказаний
  email, але тільки якщо користувач не верифікований.
- Якщо користувач вже пройшов верифікацію відправити json з ключем
  `{"message":"Verification has already been passed"}` зі статусом `400 Bad Request`.

### Логін @ POST /api/users/login

- В моделі `User` знаходить користувача за `email`.
- Валідує усі обов'язкові поля (email і password). При помилці валідації повертає помилку валідації.
- В іншому випадку, порівнює пароль для знайденого користувача, якщо паролі збігаються створює
  токен, зберігає в поточного юзера і повертає успішну відповідь.
- Якщо пароль або імейл невірний, повертає помилку Unauthorized.

### Логаут @ PATCH /api/users/logout

- Доданий в раут мідлвар перевірки токена.
- У моделі `User` знаходить користувача за `_id`.
- Якщо користувача не існує повертає помилку Unauthorized.
- В іншому випадку, видаляє токен у поточного юзера і повертає успішну відповідь.

### Поточний користувач - отримати дані юзера по токену @ GET /api/users/current

- Доданий в раут мідлвар перевірки токена.
- Якщо користувача не існує повертає помилку Unauthorized.
- В іншому випадку повертає успішну відповідь].

### Поновлення аватарки @ PATCH /api/users/avatars

- Створена папка `tmp` в корені проекту і зберігає завантажену аватарку.
- Аватарка обробляється пакетом [jimp](https://www.npmjs.com/package/jimp) і ставиться розміри 250
  на 250 для неї.
- Переноситься аватарка користувача з папки `tmp` в папку `public/avatars` і дається їй унікальне
  ім'я для конкретного користувача (його айді з DB).
- Отриманий `URL` `/avatars/<ім'я файлу з розширенням>` зберігаеться в поле `avatarURL` користувача.

# REST API підтримує такі раути для `contacts` 📒 :

### @ GET /api/contacts

- нічого не отримує
- викликає функцію `listContacts` для роботи з json-файлом `contacts.json`
- повертає масив всіх контактів в json-форматі зі статусом `200`

### @ GET /api/contacts/:id

- Не отримує `body`
- Отримує параметр `id`
- викликає функцію `getById` для роботи з json-файлом `contacts.json`
- якщо такий `id` є, повертає об'єкт контакту в json-форматі зі статусом `200`
- якщо такого `id` немає, повертає json з ключем `"message": "Not found"` і статусом `404`

### @ POST /api/contacts

- Отримує `body` в форматі `{name, email, phone}` (усі поля обов'язкові)
- Якщо в `body` немає якихось обов'язкових полів, повертає json з ключем
  `{"message": "missing required name field"}` і статусом `400`
- Якщо з `body` все добре, додає унікальний ідентифікатор в об'єкт контакту
- Викликає функцію `addContact(body)` для збереження контакту в файлі `contacts.json`
- За результатом роботи функції повертає об'єкт з доданим `id` `{id, name, email, phone}` і статусом
  `201`

### @ DELETE /api/contacts/:id

- Не отримує `body`
- Отримує параметр `id`
- Викликає функцію `removeContact` для роботи з json-файлом `contacts.json`
- якщо такий `id` є, повертає json формату `{"message": "contact deleted"}` і статусом `200`
- якщо такого `id` немає, повертає json з ключем `"message": "Not found"` і статусом `404`

### @ PUT /api/contacts/:id

- Отримує параметр `id`
- Отримує `body` в json-форматі з оновленням будь-яких полів `name, email и phone`
- Якщо `body` немає, повертає json з ключем `{"message": "missing fields"}` і статусом `400`
- Якщо з `body` все добре, викликає функцію `updateContact(contactId, body)`. (Напиши її) для
  поновлення контакту в файлі `contacts.json`
- За результатом роботи функції повертає оновлений об'єкт контакту і статусом `200`. В іншому
  випадку, повертає json з ключем `"message": "Not found"` і статусом `404`

### @ PATCH /api/contacts/:id/favorite

- Отримує параметр `contactId`
- Отримує `body` в json-форматі з оновленням поля` favorite`
- Якщо `body` немає, повертає json з ключем`{ "message": "missing field favorite"}`і статусом` 400`
- Якщо з `body` все добре, викликає функцію` updateStatusContact (contactId, body)` (напиши її) для
  поновлення контакту в базі)
- За результатом роботи функції повертає оновлений об'єкт контакту і статусом `200`. В іншому
  випадку, повертає json з ключем `" message ":" Not found "` і статусом `404`

Маршрути що приймають дані (`POST`, ` PUT` та `PATCH `) мають валідацію отриманих даних.

# ДОДАТКОВО ✅

- #### Перевірка токена:

  Створений мідлвар для перевірки токена і доданий до всіх раутів, які повинні бути захищені.
  Мідлвар бере токен з заголовків `Authorization`, перевіряє токен на валідність. У випадку помилки
  повертає помилку Unauthorized. Якщо валідація пройшла успішно, отримає з токена `id` користувача.
  Знаходить користувача в базі даних з цим `id`. Якщо користувач існує і токен збігається з тим, що
  знаходиться в базі, записує його дані в `req.user` і викликає `next()`. Якщо користувача з таким
  `id` НЕ існує або токени не збігаються, повертає помилку Unauthorized.

- #### Пагінаця для колекції контактів:

  GET /api/users/current

- #### Фільтрація контактів по полю обраного:

  GET /api/contacts?favorite=true

- #### Оновлення підписки (`subscription`) користувача:
  PATCH /api/users/ Підписка ма' одне з наступних значень `['starter', 'pro', 'business']`

### Команди:

- `npm start` &mdash; старт сервера в режимі production
- `npm run start:dev` &mdash; старт сервера в режимі розробки (development)
- `npm run lint` &mdash; запустити виконання перевірки коду з eslint, необхідно виконувати перед
  кожним PR та виправляти всі помилки лінтера
- `npm lint:fix` &mdash; та ж перевірка лінтера, але з автоматичними виправленнями простих помилок
