# iPhone Store 📱

মোবাইল শোরুম ম্যানেজমেন্ট ওয়েব অ্যাপ — স্টক, বিক্রি, বাকি হিসাব, খরচ ও নিট প্রফিট এক জায়গায়।

**স্ট্যাক:** Next.js 14 (App Router, Edge Runtime) + Cloudflare Pages + Cloudflare D1

---

## ফিচার

- **ড্যাশবোর্ড স্ট্যাটস** (সবসময় উপরে দেখা যায়, রিয়েল-টাইম): টোটাল ক্যাশ, আজকের সেল, মোট ক্রয়, স্টক সংখ্যা, প্রফিট (এ পর্যন্ত)
- **স্টক**: ফোন এন্ট্রি (নাম/মডেল, IMEI, ক্রয়মূল্য, ক্রয়ের তারিখ), Unsold/Sold স্ট্যাটাস
- **বিক্রি**: বিক্রয়মূল্য দিলে অটো প্রফিট হিসাব, Due/বাকি টগল, কাস্টমার নাম-নম্বর, আংশিক/সম্পূর্ণ বাকি পরিশোধ ট্র্যাকিং, বিক্রির সাথে সাথে PDF রিসিট ডাউনলোড
- **খরচ**: কাস্টম ঘর (ডেজিগনেশনসহ) তৈরি করে প্রতিদিনের খরচ এন্ট্রি, অটো টোটাল
- **নিট প্রফিট**: তারিখ-রেঞ্জ ফিল্টার সহ — স্টক প্রফিট + Outside প্রফিট − মোট খরচ
- **Gadgets & Accessories**: আলাদা একটা ট্যাব — Buy Name, Buy Price, Sell — শুধুমাত্র এই ট্যাবে ঢুকলেই দেখা যায়, এর প্রফিট মূল ড্যাশবোর্ড/নিট প্রফিটে যোগ হয় না
- **নিচের অ্যাকশন বার — Sell / Outside Sell / Buy** (যেকোনো ট্যাব থেকে খোলা যায়):
  - **Sell**: মূল স্টক থেকে বিক্রি — Name, Number, Model, IMEI, Price দিয়ে সরাসরি বিক্রি করে "iPhone Store" হেডারসহ মেমো তৈরি হয়
  - **Buy**: ফোন ক্রয় — Model Number, IMEI (স্ক্যানারসহ), RAM/ROM, Buy Price, Buy from whom, Number, NID — সাবমিট করলেই সরাসরি **স্টকে** যোগ হয়ে যায় (Stock ট্যাবে সাথে সাথে দেখা যাবে)
  - **Outside Sell**: আলাদা একটা প্রফিট লগ, স্টকের সাথে সম্পর্কিত না — শুধু ৩টা ঘর: Model, IMEI, Profit — এই প্রফিট সরাসরি মোট প্রফিট ও ক্যাশে যোগ হয়
- **বারকোড**: IMEI দিয়ে Code128 স্টিকার প্রিন্ট, ক্যামেরা দিয়ে স্ক্যান, এবং Bluetooth/USB হার্ডওয়্যার স্ক্যানার (keyboard-emulation মোডে) সাপোর্ট
- মোবাইল-ফার্স্ট, প্রিমিয়াম ডার্ক UI, বাংলা ইন্টারফেস

## যা এখনো ম্যানুয়াল (আপনার শোরুমের প্রিন্টার অনুযায়ী)

- বারকোড স্টিকার প্রিন্ট এই মুহূর্তে ব্রাউজারের প্রিন্ট ডায়ালগ ব্যবহার করে (যেকোনো প্রিন্টারে কাজ করবে)। যদি নির্দিষ্ট একটা Bluetooth লেবেল প্রিন্টার (যেমন Zebra, Xprinter ইত্যাদি) ব্যবহার করেন এবং সরাসরি সেটাতে পাঠাতে চান, প্রিন্টারের ব্র্যান্ড/মডেল জানালে সেটার জন্য আলাদা ইন্টিগ্রেশন যোগ করে দেওয়া যাবে।

---

## লোকাল ডেভেলপমেন্ট

```bash
npm install
cp .dev.vars.example .dev.vars   # (ঐচ্ছিক, দরকার নেই local D1-এর জন্য)

# লোকাল D1 ডাটাবেস বানিয়ে স্কিমা বসান
npx wrangler d1 execute iphone-store-db --local --file=migrations/0001_init.sql
npx wrangler d1 execute iphone-store-db --local --file=migrations/0002_buy_sell_split.sql
npx wrangler d1 execute iphone-store-db --local --file=migrations/0003_phones_buy_fields.sql
npx wrangler d1 execute iphone-store-db --local --file=migrations/0004_gadgets.sql

# বিল্ড করে Cloudflare Pages dev সার্ভার চালান (D1 বাইন্ডিং সহ)
npm run build
npx @cloudflare/next-on-pages
npx wrangler pages dev .vercel/output/static --d1 DB=iphone-store-db
```

তারপর ব্রাউজারে `http://localhost:8788` খুলুন।

> সাধারণ `next dev` দিয়ে চালালে D1 বাইন্ডিং পাওয়া যাবে না (কারণ D1 শুধু Cloudflare Workers/Pages রানটাইমে কাজ করে) — তাই লোকাল টেস্টের জন্য উপরের `wrangler pages dev` কমান্ডই ব্যবহার করতে হবে।

---

## Cloudflare-এ ডিপ্লয় করার ধাপ

### ১. D1 ডাটাবেস তৈরি করুন

```bash
npx wrangler login
npx wrangler d1 create iphone-store-db
```

এই কমান্ড থেকে যে `database_id` পাবেন, সেটা `wrangler.toml` ফাইলে `REPLACE-WITH-YOUR-D1-DATABASE-ID` জায়গায় বসান।

### ২. প্রোডাকশন ডাটাবেসে স্কিমা বসান

```bash
npx wrangler d1 execute iphone-store-db --remote --file=migrations/0001_init.sql
npx wrangler d1 execute iphone-store-db --remote --file=migrations/0002_buy_sell_split.sql
npx wrangler d1 execute iphone-store-db --remote --file=migrations/0003_phones_buy_fields.sql
npx wrangler d1 execute iphone-store-db --remote --file=migrations/0004_gadgets.sql
```

> ইতিমধ্যে ডিপ্লয় করা থাকলে শুধু নতুন মাইগ্রেশনগুলো চালালেই হবে — এগুলো বিদ্যমান ডেটা মুছে না, শুধু নতুন কলাম যোগ করে।

### ৩. Cloudflare Pages প্রজেক্ট তৈরি করুন

```bash
npx wrangler pages project create iphone-store
```

(GitHub-এ পুশ করে Git integration দিয়েও করতে পারেন — dental-platform প্রজেক্টে যেভাবে করেছিলেন সেভাবেই)

### ৪. Pages প্রজেক্টে D1 বাইন্ডিং যোগ করুন

Cloudflare Dashboard → Workers & Pages → iphone-store → Settings → Bindings →
"D1 database" যোগ করুন:
- Variable name: `DB`
- Database: `iphone-store-db`

(Production ও Preview — দুই environment-এই যোগ করুন)

### ৫. বিল্ড ও ডিপ্লয়

```bash
npm run build
npx @cloudflare/next-on-pages
npx wrangler pages deploy .vercel/output/static --project-name=iphone-store
```

Git integration ব্যবহার করলে Cloudflare Dashboard-এ:
- **Build command:** `npx @cloudflare/next-on-pages`
- **Build output directory:** `.vercel/output/static`

---

## ফোল্ডার গঠন

```
app/
  page.tsx                  ড্যাশবোর্ড (স্ট্যাটস + ৩ ট্যাব + নিচের অ্যাকশন বার)
  components/
    DashboardStats.tsx       উপরের ৫টা রিয়েল-টাইম স্ট্যাট
    StockTab.tsx             স্টক + বিক্রি + বাকি + বারকোড
    ExpenseTab.tsx            খরচের ঘর + এন্ট্রি
    ProfitTab.tsx             Outside Sell প্রফিট লগ + নিট প্রফিট সামারি
    GadgetsTab.tsx            Gadgets & Accessories — স্বতন্ত্র buy/sell লগ, মূল প্রফিটে যোগ হয় না
    BottomActionBar.tsx      Sell / Outside Sell / Buy বার
    SellSheet.tsx             Sell ফর্ম (Name, Number, Model, IMEI, Price) + মেমো
    OutsideSellSheet.tsx      Outside Sell ফর্ম — শুধু Model, IMEI, Profit (স্বতন্ত্র প্রফিট লগ)
    BuySheet.tsx              Buy ফর্ম (Model, IMEI, RAM/ROM, Buy Price, Buy from whom, Number, NID) — সরাসরি স্টকে যোগ হয়
    BarcodeScanner.tsx        ক্যামেরা + হার্ডওয়্যার স্ক্যান
    BarcodeSticker.tsx        IMEI বারকোড রেন্ডার
    ui.tsx                    শেয়ার্ড UI (বাটন, ইনপুট, শিট)
  api/                       সব API রুট (Edge runtime, D1 এক্সেস) — dashboard/ রুটসহ
lib/
  db.ts                      D1 বাইন্ডিং হেল্পার
  types.ts                   TypeScript টাইপ
  invoice.ts                 PDF রিসিট/মেমো জেনারেটর
  events.ts                  ড্যাশবোর্ড রিফ্রেশ ইভেন্ট (mutation হলেই স্ট্যাটস আপডেট হয়)
migrations/
  0001_init.sql              মূল স্কিমা
  0002_buy_sell_split.sql    outside_deals-এ Outside Sell-এর জন্য প্রয়োজনীয় কলাম (status, sell_date ইত্যাদি)
  0003_phones_buy_fields.sql phones টেবিলে Buy-ফর্মের কলাম (ram_rom, bought_from, phone_number, nid)
  0004_gadgets.sql           নতুন gadgets টেবিল (Gadgets & Accessories ট্যাবের জন্য)
wrangler.toml                Cloudflare কনফিগ (এখানে D1 database_id বসাতে হবে)
```

## ডেটা কোথায় থাকে

সব ডেটা Cloudflare D1-এ (Cloudflare-এর সার্ভারলেস SQLite ডাটাবেস) জমা হয়। তাই অ্যাপ ব্যবহারের সময় ইন্টারনেট কানেকশন লাগবে। প্রতিটি এন্ট্রি সরাসরি ডাটাবেসে সেভ হয়, রিয়েলটাইমে তারিখ/সময় বসে।
