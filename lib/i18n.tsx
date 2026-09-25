"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";

export type Lang = "en" | "bn";

type Entry = { en: string; bn: string };

// Central dictionary — every user-facing string in the app, keyed by a
// short "component.name" id. English is the default language; Bengali is
// available from the toggle in the sidebar. Components call t("key") and
// get the string in whichever language is currently selected. Grown
// file-by-file as each screen is translated.
export const STRINGS: Record<string, Entry> = {
  // --- app shell -----------------------------------------------------
  "app.title": { en: "Apple Store Satkhira", bn: "Apple Store Satkhira" },
  "app.tagline": { en: "Mobile Shop Management", bn: "মোবাইল শোরুম ম্যানেজমেন্ট" },

  // --- sidebar ---------------------------------------------------------
  "sidebar.stock": { en: "Stock", bn: "স্টক" },
  "sidebar.expense": { en: "Expense", bn: "খরচ" },
  "sidebar.profit": { en: "Profit", bn: "প্রফিট" },
  "sidebar.gadgets": { en: "Gadgets", bn: "Gadgets" },
  "sidebar.sell": { en: "Sell", bn: "বিক্রি" },
  "sidebar.buy": { en: "Buy", bn: "কিনুন" },
  "sidebar.settings": { en: "Settings", bn: "সেটিংস" },
  "sidebar.language": { en: "Language", bn: "ভাষা" },

  // --- shared (ui.tsx / BarcodeScanner) --------------------------------
  "common.reset_form": { en: "Reset form", bn: "ফর্ম রিসেট করুন" },
  "common.prev_month": { en: "Previous month", bn: "আগের মাস" },
  "common.next_month": { en: "Next month", bn: "পরের মাস" },
  "common.close": { en: "Close", bn: "বন্ধ করুন" },
  "common.save_could_not": { en: "Could not save", bn: "সেভ করা যায়নি" },

  // --- Buy sheet ---------------------------------------------------------
  "buy.title": { en: "Buy Phone", bn: "ফোন ক্রয় (Buy)" },
  "buy.date_label": { en: "Buy Date", bn: "ক্রয়ের তারিখ" },
  "buy.history_label": { en: "Purchase History", bn: "ক্রয় ইতিহাস" },
  "buy.history_desc": {
    en: "What was bought from whom — all-time or a date range, filtered by Supplier or Used Phone",
    bn: "কার কাছ থেকে কী কেনা হয়েছে — এ যাবতকাল বা ডেট রেঞ্জ, সাপ্লায়ার বা ইউজড ফোন দিয়ে ফিল্টার করে",
  },
  "buy.download": { en: "Download", bn: "ডাউনলোড" },
  "buy.saved_success": { en: "Purchase saved — added to stock ✓", bn: "ক্রয় সেভ হয়েছে — স্টকে যোগ হয়েছে ✓" },
  "buy.buy_another": { en: "Buy another phone", bn: "আরেকটা ফোন ক্রয় করুন" },
  "buy.seller_type_label": { en: "Seller Type", bn: "বিক্রেতার ধরন" },
  "buy.seller_supplier": { en: "Supplier", bn: "সাপ্লায়ার" },
  "buy.seller_individual": { en: "Used Phone", bn: "ইউজড ফোন" },
  "buy.seller_individual_note": {
    en: "When buying directly from an individual, both sides of their NID card and their photo will be kept for accountability.",
    bn: "ব্যক্তির কাছ থেকে সরাসরি কিনলে জবাবদিহিতার জন্য এন আইডি কার্ডের দুই পাশ ও তার একটা ছবি তুলে রাখা হবে।",
  },
  "buy.nid_front": { en: "NID Card — Page 1", bn: "এন আই ডি কার্ডের ১ম পেজ" },
  "buy.nid_back": { en: "NID Card — Page 2", bn: "এন আই ডি কার্ডের ২য় পেজ" },
  "buy.person_photo": { en: "Person's Photo", bn: "ব্যবহারকারীর ছবি" },
  "buy.photo_retake": { en: "Retake", bn: "আবার তুলুন" },
  "buy.photo_take": { en: "Take Photo", bn: "ছবি তুলুন" },
  "buy.model_label": { en: "Model Number", bn: "Model Number" },
  "buy.model_placeholder": { en: "e.g. iPhone 12, 128GB", bn: "যেমন: iPhone 12, 128GB" },
  "buy.imei_label": { en: "IMEI", bn: "IMEI" },
  "buy.imei_placeholder": { en: "IMEI number", bn: "IMEI নম্বর" },
  "buy.imei_scan_aria": { en: "Scan IMEI", bn: "IMEI স্ক্যান করুন" },
  "buy.ram_rom_label": { en: "RAM/ROM", bn: "RAM/ROM" },
  "buy.ram_rom_placeholder": { en: "e.g. 4/64 GB", bn: "যেমন: 4/64 GB" },
  "buy.battery_label": { en: "Battery Health (optional)", bn: "Battery Health (ঐচ্ছিক)" },
  "buy.battery_placeholder": { en: "e.g. 92%", bn: "যেমন: 92%" },
  "buy.price_label": { en: "Buy Price (৳)", bn: "Buy Price (৳)" },
  "buy.bought_from_label": { en: "Buy from whom", bn: "কার কাছ থেকে কেনা হয়েছে" },
  "buy.bought_from_placeholder": { en: "Type a supplier name — pick from the list or add new", bn: "সাপ্লায়ারের নাম লিখুন — লিস্ট থেকে বেছে নিন অথবা নতুন যোগ করুন" },
  "buy.supplier_matched_note": { en: "Known supplier — Number/NID already on file", bn: "সেভ করা সাপ্লায়ার — নাম্বার/এনআইডি আগে থেকেই সংরক্ষিত আছে" },
  "buy.number_label": { en: "Number", bn: "নম্বর" },
  "buy.nid_label": { en: "NID", bn: "NID" },
  "buy.validation_required": {
    en: "Please fill in Model Number, IMEI, Buy Price and Buy from whom",
    bn: "Model Number, IMEI, Buy Price ও Buy from whom — এই ঘরগুলো পূরণ করুন",
  },
  "buy.validation_photos": {
    en: "Buying from an individual needs all three photos: both sides of the NID card and the person's photo",
    bn: "ব্যক্তিগত ফোন কিনলে এন আইডি কার্ডের ২ পাশ ও ব্যবহারকারীর ছবি — তিনটাই তুলতে হবে",
  },
  "buy.saving": { en: "Saving...", bn: "সেভ হচ্ছে..." },
  "buy.save_button": { en: "Save Purchase", bn: "ক্রয় সেভ করুন" },
  "buy.history_title": { en: "Download Purchase History", bn: "ক্রয় ইতিহাস ডাউনলোড" },
  "buy.history_from": { en: "Start Date (optional)", bn: "শুরুর তারিখ (ঐচ্ছিক)" },
  "buy.history_to": { en: "End Date (optional)", bn: "শেষ তারিখ (ঐচ্ছিক)" },
  "buy.history_note": {
    en: "Leaving both empty downloads the full all-time purchase history.",
    bn: "দুটোই ফাঁকা রাখলে এ যাবতকালের সকল ক্রয় ইতিহাস ডাউনলোড হবে।",
  },
  "buy.history_filter_label": { en: "Filter", bn: "ফিল্টার" },
  "buy.history_filter_all": { en: "All", bn: "সব" },
  "buy.history_supplier_select_label": { en: "Supplier", bn: "সাপ্লায়ার" },
  "buy.history_supplier_all_option": { en: "All Suppliers", bn: "সব সাপ্লায়ার" },
  "buy.history_photos_note": {
    en: "Used Phone purchases will also include each seller's NID and photo in the PDF -- this may take a little longer to generate.",
    bn: "ইউজড ফোন ক্রয়ের সাথে সেলারের এন আই ডি ও ছবিও পিডিএফে যুক্ত হবে -- তাই তৈরি হতে একটু বেশি সময় লাগতে পারে।",
  },
  "buy.history_generating": { en: "Generating...", bn: "তৈরি হচ্ছে..." },
  "buy.history_download_pdf": { en: "Download PDF", bn: "PDF ডাউনলোড করুন" },
  "buy.history_load_failed": { en: "Could not load history", bn: "ইতিহাস লোড করা যায়নি" },
  "buy.pdf_empty": { en: "No purchases in this period", bn: "এই সময়ের মধ্যে কোনো ক্রয় নেই" },
  "buy.pdf_from_start": { en: "from the start", bn: "শুরু থেকে" },
  "buy.pdf_until_today": { en: "until today", bn: "আজ পর্যন্ত" },

  // --- Sell sheet --------------------------------------------------------
  "sell.title": { en: "Sell Phone", bn: "ফোন বিক্রি (Sell)" },
  "sell.name_label": { en: "Name", bn: "নাম" },
  "sell.number_label": { en: "Number", bn: "নম্বর" },
  "sell.date_label": { en: "Sale Date", bn: "বিক্রয়ের তারিখ" },
  "sell.address_label": { en: "Address (optional)", bn: "ঠিকানা (ঐচ্ছিক)" },
  "sell.email_label": { en: "Email (optional)", bn: "ইমেইল (ঐচ্ছিক)" },
  "sell.narration_label": { en: "Narration / Note (optional)", bn: "মন্তব্য / নোট (ঐচ্ছিক)" },
  "sell.narration_placeholder": { en: "e.g. Box included, no charger", bn: "যেমন: বক্স আছে, চার্জার নেই" },
  "sell.imei_label": { en: "IMEI", bn: "IMEI" },
  "sell.imei_placeholder": { en: "Type a few digits and a list will appear", bn: "কয়েক ডিজিট লিখলেই লিস্ট আসবে" },
  "sell.imei_scan_aria": { en: "Scan IMEI", bn: "IMEI স্ক্যান করুন" },
  "sell.searching": { en: "Searching...", bn: "খোঁজা হচ্ছে..." },
  "sell.found_in_stock": { en: "Found in stock —", bn: "স্টক থেকে পাওয়া গেছে —" },
  "sell.model_label": { en: "Model", bn: "Model" },
  "sell.model_placeholder": { en: "Phone name and model", bn: "ফোনের নাম ও মডেল" },
  "sell.ram_rom_label": { en: "RAM/ROM (optional)", bn: "RAM/ROM (ঐচ্ছিক)" },
  "sell.ram_rom_placeholder": { en: "e.g. 4/64 GB", bn: "যেমন: 4/64 GB" },
  "sell.battery_label": { en: "Battery Health (optional)", bn: "Battery Health (ঐচ্ছিক)" },
  "sell.battery_placeholder": { en: "e.g. 92%", bn: "যেমন: 92%" },
  "sell.price_label": { en: "Price (৳)", bn: "Price (৳)" },
  "sell.due_checkbox": { en: "Due Sale (Due)", bn: "বাকি বিক্রি (Due)" },
  "sell.paid_now_label": { en: "Amount paid now (advance, 0 if none)", bn: "এখন কত টাকা দিলো (অগ্রিম, না দিলে ০)" },
  "sell.validation_all_fields": { en: "Please fill in all fields", bn: "সব ঘর পূরণ করুন" },
  "sell.already_sold": { en: "This phone has already been sold", bn: "এই ফোনটি ইতিমধ্যে বিক্রি হয়ে গেছে" },
  "sell.saving": { en: "Saving...", bn: "সেভ হচ্ছে..." },
  "sell.confirm_button": { en: "Confirm Sale & Generate Memo", bn: "বিক্রি নিশ্চিত করুন ও মেমো বানান" },
  "sell.history_label": { en: "Sale History", bn: "সেল হিস্ট্রি" },
  "sell.history_desc": { en: "Browse or search past sales and reprint memos", bn: "পুরাতন বিক্রয় দেখুন বা খুঁজুন, মেমো আবার প্রিন্ট করুন" },
  "sell.history_button": { en: "View History", bn: "হিস্ট্রি দেখুন" },
  "sell.history_title": { en: "Sale History", bn: "সেল হিস্ট্রি" },
  "sell.history_search_label": { en: "Search (name, phone or invoice no.)", bn: "খুঁজুন (নাম, নাম্বার বা ইনভয়েস নং)" },
  "sell.history_search_placeholder": { en: "e.g. Rahim, 017..., or INV-42", bn: "যেমন: রহিম, 017..., বা INV-42" },
  "sell.history_from": { en: "From", bn: "শুরুর তারিখ" },
  "sell.history_to": { en: "To", bn: "শেষ তারিখ" },
  "sell.history_search_button": { en: "Search", bn: "খুঁজুন" },
  "sell.history_loading": { en: "Loading...", bn: "লোড হচ্ছে..." },
  "sell.history_empty": { en: "No sales found", bn: "কোনো বিক্রয় পাওয়া যায়নি" },
  "sell.history_view_memo": { en: "View / Reprint Memo", bn: "মেমো দেখুন / রিপ্রিন্ট করুন" },
  "sell.history_download_pdf": { en: "Download PDF Report", bn: "PDF রিপোর্ট ডাউনলোড করুন" },
  "sell.history_generating": { en: "Generating...", bn: "তৈরি হচ্ছে..." },
  "sell.history_load_failed": { en: "Failed to load sale history", bn: "সেল হিস্ট্রি লোড করা যায়নি" },
  "sell.history_due_badge": { en: "Due", bn: "বাকি" },
  "sell.history_paid_badge": { en: "Paid", bn: "পরিশোধিত" },
  "sell.history_invoice_prefix": { en: "Invoice #", bn: "ইনভয়েস #" },

  // --- Settings sheet ------------------------------------------------
  "settings.title": { en: "Settings", bn: "সেটিংস" },
  "settings.current_username_label": { en: "Current User ID", bn: "বর্তমান ইউজার আইডি" },
  "settings.fix_cash_heading": { en: "Fix Total Cash", bn: "টোটাল ক্যাশ ঠিক করুন" },
  "settings.current_total_cash": { en: "Current Total Cash", bn: "বর্তমান টোটাল ক্যাশ" },
  "settings.new_total_cash_label": { en: "New Total Cash (৳)", bn: "নতুন টোটাল ক্যাশ (৳)" },
  "settings.cash_invalid": { en: "Please enter a valid amount", bn: "সঠিক টাকার পরিমাণ দিন" },
  "settings.cash_confirm": {
    en: "Change Total Cash from ৳{from} to ৳{to}? Stock/sales data won't change.",
    bn: "টোটাল ক্যাশ ৳{from} থেকে ৳{to} করবেন? স্টক/সেলের কোনো তথ্য বদলাবে না।",
  },
  "settings.cash_saving": { en: "Saving...", bn: "সেভ হচ্ছে..." },
  "settings.cash_fix_button": { en: "Fix Cash", bn: "ক্যাশ ঠিক করুন" },
  "settings.cash_updated": { en: "Total Cash updated ✓", bn: "টোটাল ক্যাশ আপডেট হয়েছে ✓" },
  "settings.cash_note": {
    en: "This only corrects the Total Cash figure — it doesn't change stock, sales, expenses or any other data.",
    bn: "এটা শুধু টোটাল ক্যাশের হিসাব ঠিক করে — স্টক, সেল, খরচ বা অন্য কোনো তথ্য বদলায় না।",
  },
  "settings.change_credentials_heading": { en: "Change User ID / Password", bn: "ইউজার আইডি / পাসওয়ার্ড পরিবর্তন" },
  "settings.current_password_label": { en: "Current Password", bn: "বর্তমান পাসওয়ার্ড" },
  "settings.new_username_label": { en: "New User ID (optional)", bn: "নতুন ইউজার আইডি (ঐচ্ছিক)" },
  "settings.new_password_label": { en: "New Password (optional, min 6 characters)", bn: "নতুন পাসওয়ার্ড (ঐচ্ছিক, কমপক্ষে ৬ অক্ষর)" },
  "settings.confirm_password_label": { en: "Re-enter New Password", bn: "নতুন পাসওয়ার্ড আবার লিখুন" },
  "settings.enter_current_password": { en: "Please enter your current password", bn: "বর্তমান পাসওয়ার্ড দিন" },
  "settings.password_mismatch": { en: "New passwords don't match", bn: "নতুন পাসওয়ার্ড দুই ঘরে মিলছে না" },
  "settings.need_username_or_password": {
    en: "Enter at least a new User ID or Password",
    bn: "নতুন ইউজার আইডি বা পাসওয়ার্ড অন্তত একটি দিন",
  },
  "settings.saving": { en: "Saving...", bn: "সেভ হচ্ছে..." },
  "settings.save_button": { en: "Save", bn: "সেভ করুন" },
  "settings.saved_success": { en: "Saved ✓", bn: "সেভ হয়েছে ✓" },
  "settings.logging_out": { en: "Logging out...", bn: "লগআউট হচ্ছে..." },
  "settings.logout_button": { en: "Log Out", bn: "লগআউট" },

  // --- Login page ------------------------------------------------------
  "login.heading": { en: "Log In", bn: "লগইন করুন" },
  "login.username_label": { en: "User ID", bn: "ইউজার আইডি" },
  "login.password_label": { en: "Password", bn: "পাসওয়ার্ড" },
  "login.validation": { en: "Please enter User ID and Password", bn: "ইউজার আইডি ও পাসওয়ার্ড দিন" },
  "login.failed": { en: "Login failed", bn: "লগইন ব্যর্থ হয়েছে" },
  "login.checking": { en: "Checking...", bn: "চেক করা হচ্ছে..." },
  "login.button": { en: "Log In", bn: "লগইন" },

  // --- Barcode scanner -------------------------------------------------
  "scanner.heading": { en: "Scan Barcode", bn: "বারকোড স্ক্যান করুন" },
  "scanner.hardware_mode": { en: "Hardware Scanner", bn: "হার্ডওয়্যার স্ক্যানার" },
  "scanner.camera_mode": { en: "Camera", bn: "ক্যামেরা" },
  "scanner.hardware_hint": {
    en: "Point the scanner at the barcode — it will auto-fill below",
    bn: "স্ক্যানার দিয়ে বারকোডে পয়েন্ট করুন — নিচের ঘরে অটো বসে যাবে",
  },
  "scanner.hardware_placeholder": { en: "Scan or type...", bn: "স্ক্যান করুন বা টাইপ করুন..." },
  "scanner.search_button": { en: "Search", bn: "খুঁজুন" },
  "scanner.camera_permission_note": {
    en: "Allow the browser camera access in camera mode",
    bn: "ক্যামেরা মোডে ব্রাউজারকে ক্যামেরা অ্যাক্সেসের অনুমতি দিন",
  },

  // --- Live camera capture (NID/person photos in the Buy sheet) --------
  "camera.heading": { en: "Take Photo", bn: "ছবি তুলুন" },
  "camera.capture": { en: "Capture", bn: "ছবি তুলুন" },
  "camera.retake": { en: "Retake", bn: "আবার তুলুন" },
  "camera.use_photo": { en: "Use This Photo", bn: "এই ছবিটি ব্যবহার করুন" },
  "camera.unavailable": {
    en: "Couldn't access the camera. Check the browser's camera permission, or upload a photo instead.",
    bn: "ক্যামেরা চালু করা যায়নি। ব্রাউজারের ক্যামেরা পারমিশন চেক করুন, অথবা ছবি আপলোড করুন।",
  },
  "camera.upload_instead": { en: "Upload a photo instead", bn: "ছবি আপলোড করুন" },
  "camera.permission_note": {
    en: "Allow camera access when the browser asks",
    bn: "ব্রাউজার জিজ্ঞেস করলে ক্যামেরা অ্যাক্সেসের অনুমতি দিন",
  },

  // --- expense tab -----------------------------------------------------
  "expense.today": { en: "Today's Expense", bn: "আজকের খরচ" },
  "expense.this_month": { en: "This Month's Expense", bn: "এই মাসের খরচ" },
  "expense.categories_heading": { en: "Expense Categories", bn: "খরচের ঘরসমূহ" },
  "expense.new_category": { en: "+ New Category", bn: "+ নতুন ঘর" },
  "expense.no_categories": {
    en: "No expense categories created yet — e.g. electricity bill, shop rent, staff salary",
    bn: "এখনো কোনো খরচের ঘর তৈরি হয়নি — যেমন: কারেন্ট বিল, দোকান ভাড়া, স্টাফ বেতন ইত্যাদি",
  },
  "expense.entries_heading": { en: "Expense Entries", bn: "খরচের এন্ট্রি" },
  "expense.download_pdf": { en: "Download PDF", bn: "PDF ডাউনলোড" },
  "expense.loading": { en: "Loading...", bn: "লোড হচ্ছে..." },
  "expense.no_entries": { en: "No expense entries", bn: "কোনো খরচ এন্ট্রি নেই" },
  "expense.entries_count": { en: "{count} entries", bn: "{count}টি এন্ট্রি" },
  "expense.total_entries_count": { en: "Total ({count} entries)", bn: "মোট ({count}টি এন্ট্রি)" },
  "expense.add_new_aria": { en: "Add new expense", bn: "নতুন খরচ যোগ করুন" },
  "expense.new_category_title": { en: "New Expense Category", bn: "নতুন খরচের ঘর" },
  "expense.category_name_label": {
    en: "Category name (e.g. electricity bill, shop rent)",
    bn: "ঘরের নাম (যেমন: কারেন্ট বিল, দোকান ভাড়া)",
  },
  "expense.designation_label": {
    en: "Designation (optional, e.g. staff position)",
    bn: "ডেজিগনেশন (ঐচ্ছিক, যেমন: স্টাফের পদবী)",
  },
  "expense.saving": { en: "Saving...", bn: "সেভ হচ্ছে..." },
  "expense.create": { en: "Create", bn: "তৈরি করুন" },
  "expense.new_entry_title": { en: "New Expense Entry", bn: "নতুন খরচ এন্ট্রি" },
  "expense.select_category_label": { en: "Select category", bn: "ঘর বাছাই করুন" },
  "expense.select_placeholder": { en: "— Select —", bn: "— বাছাই করুন —" },
  "expense.amount_label": { en: "Amount (৳)", bn: "পরিমাণ (৳)" },
  "expense.date_label": {
    en: "Date (leave blank for today's date)",
    bn: "তারিখ (ফাঁকা রাখলে আজকের তারিখ বসবে)",
  },
  "expense.note_label": { en: "Note (optional)", bn: "নোট (ঐচ্ছিক)" },
  "expense.add_button": { en: "Add", bn: "যোগ করুন" },
  "expense.name_required": { en: "Enter category name", bn: "ঘরের নাম দিন" },
  "expense.save_failed": { en: "Could not save", bn: "সেভ করা যায়নি" },
  "expense.delete_category_confirm": {
    en: "This category and all its expense entries will be deleted. Are you sure?",
    bn: "এই ঘরটি ও এর সব খরচ এন্ট্রি মুছে যাবে। নিশ্চিত?",
  },
  "expense.category_and_amount_required": { en: "Enter category and amount", bn: "ঘর ও পরিমাণ দিন" },
  "expense.unknown_category": { en: "Unknown", bn: "অজানা" },

  // --- profit tab -----------------------------------------------------
  "profit.net_profit_label": { en: "Net Profit (Selected Month)", bn: "নিট প্রফিট (নির্বাচিত মাসে)" },
  "profit.stock_profit": { en: "Stock Profit", bn: "স্টক প্রফিট" },
  "profit.total_expense": { en: "Total Expense", bn: "মোট খরচ" },
  "profit.due_outstanding": { en: "Due Outstanding", bn: "বকেয়া বাকি" },
  "profit.download_pdf": { en: "Download PDF", bn: "PDF ডাউনলোড" },
  "profit.loading": { en: "Loading...", bn: "লোড হচ্ছে..." },
  "profit.stock_detail_title": { en: "Stock Profit Breakdown", bn: "স্টক প্রফিটের হিসাব" },
  "profit.expense_detail_title": { en: "Total Expense Breakdown (by Category)", bn: "মোট খরচের হিসাব (খাত অনুযায়ী)" },
  "profit.due_detail_title": { en: "Due Outstanding Breakdown", bn: "বকেয়া বাকির হিসাব" },
  "profit.full_profit_prefix": { en: "Full Profit: ৳", bn: "ফুল প্রফিট: ৳" },
  "profit.total_due_label": { en: "Total Due", bn: "মোট বকেয়া" },
  "profit.no_sales_month": { en: "No sales this month", bn: "এই মাসে কোনো সেল নেই" },
  "profit.no_expense_entries_month": { en: "No expense entries this month", bn: "এই মাসে কোনো খরচ এন্ট্রি নেই" },
  "profit.no_due": { en: "No due outstanding", bn: "কোনো বকেয়া নেই" },

  // --- gadgets tab -----------------------------------------------------
  "gadgets.hero_label": {
    en: "Gadgets Profit (shown here only — not added to total profit)",
    bn: "Gadgets প্রফিট (শুধু এখানেই দেখা যাবে — মোট প্রফিটে যোগ হয় না)",
  },
  "gadgets.total_buy": { en: "Total Buy", bn: "মোট ক্রয় (Buy)" },
  "gadgets.total_sell": { en: "Total Sell", bn: "মোট বিক্রি (Sell)" },
  "gadgets.loading": { en: "Loading...", bn: "লোড হচ্ছে..." },
  "gadgets.no_entries": { en: "No entries — add a new one", bn: "কোনো এন্ট্রি নেই — নতুন যোগ করুন" },
  "gadgets.stock_status": {
    en: "In stock: {remaining} / {quantity}",
    bn: "স্টকে আছে: {remaining} / {quantity}",
  },
  "gadgets.add_new_aria": { en: "Add new entry", bn: "নতুন এন্ট্রি যোগ করুন" },
  "gadgets.buy_name_placeholder": {
    en: "e.g. Earphone, Charger, Cover",
    bn: "যেমন: Earphone, Charger, Cover",
  },
  "gadgets.buy_price_label": { en: "Buy Price (৳ / per piece)", bn: "Buy Price (৳ / প্রতি পিস)" },
  "gadgets.saving": { en: "Saving...", bn: "সেভ হচ্ছে..." },
  "gadgets.add_button": { en: "Add", bn: "যোগ করুন" },
  "gadgets.all_fields_required": { en: "Fill in all fields", bn: "সব ঘর পূরণ করুন" },
  "gadgets.save_failed": { en: "Could not save", bn: "সেভ করা যায়নি" },
  "gadgets.delete_confirm": { en: "Delete this entry?", bn: "এই এন্ট্রিটি মুছে ফেলবেন?" },
  "gadgets.sell_info": {
    en: "Buy price was ৳{price} / unit · {remaining} in stock",
    bn: "Buy দাম ছিল ৳{price} / unit · স্টকে আছে {remaining}টা",
  },
  "gadgets.sell_price_label": { en: "Sell Price (৳ / per piece)", bn: "Sell দাম (৳ / প্রতি পিস)" },
  "gadgets.sell_qty_label": {
    en: "How many are you selling (Quantity)",
    bn: "কয়টা বিক্রি করছেন (Quantity)",
  },
  "gadgets.sell_total_summary": {
    en: "Total: ৳{total} ({qty} × ৳{price})",
    bn: "মোট: ৳{total} ({qty}টা × ৳{price})",
  },
  "gadgets.confirm_sell_button": { en: "Confirm Sell", bn: "বিক্রি নিশ্চিত করুন" },
  "gadgets.invalid_sell_price": { en: "Enter a valid Sell price", bn: "সঠিক Sell দাম দিন" },
  "gadgets.invalid_quantity": { en: "Enter a valid Quantity", bn: "সঠিক Quantity দিন" },
  "gadgets.exceeds_stock": {
    en: "Only {remaining} left in stock — can't sell more than that",
    bn: "স্টকে আছে মাত্র {remaining}টা — এর বেশি বিক্রি করা যাবে না",
  },
  "gadgets.detail_profit_title": { en: "Gadgets Profit Breakdown", bn: "Gadgets প্রফিটের হিসাব" },
  "gadgets.detail_buy_title": { en: "Total Buy Breakdown", bn: "মোট ক্রয়ের (Buy) হিসাব" },
  "gadgets.detail_sell_title": { en: "Total Sell Breakdown", bn: "মোট বিক্রির (Sell) হিসাব" },
  "gadgets.no_gadgets_sold": { en: "No gadgets sold yet", bn: "এখনো কোনো গ্যাজেট বিক্রি হয়নি" },
  "gadgets.sold_count_suffix": { en: "({count} sold)", bn: "({count}টি বিক্রি)" },
  "gadgets.total_profit_label": { en: "Total Profit", bn: "মোট প্রফিট" },
  "gadgets.download_pdf": { en: "Download PDF", bn: "PDF ডাউনলোড" },
  "gadgets.no_gadgets_bought": { en: "No gadgets bought yet", bn: "এখনো কোনো গ্যাজেট কেনা হয়নি" },
  "gadgets.qty_times_price_suffix": {
    en: "({qty} × ৳{price})",
    bn: "({qty}টি × ৳{price})",
  },
  "gadgets.total_buy_label": { en: "Total Buy", bn: "মোট ক্রয়" },
  "gadgets.total_sell_label": { en: "Total Sell", bn: "মোট বিক্রি" },

  // --- stock tab -------------------------------------------------------
  "stock.selling_price_required": { en: "Enter selling price", bn: "বিক্রয়মূল্য দিন" },
  "stock.save_failed": { en: "Could not save", bn: "সেভ করা যায়নি" },
  "stock.return_failed": { en: "Could not return", bn: "রিটার্ন করা যায়নি" },
  "stock.delete_failed": { en: "Could not delete", bn: "ডিলেট করা যায়নি" },
  "stock.search_placeholder": { en: "Search by name or IMEI", bn: "নাম বা IMEI দিয়ে খুঁজুন" },
  "stock.scan_barcode_aria": { en: "Scan barcode", bn: "বারকোড স্ক্যান" },
  "stock.filter_unsold": { en: "In Stock", bn: "স্টকে আছে" },
  "stock.filter_sold": { en: "Sold", bn: "বিক্রি হয়েছে" },
  "stock.filter_all": { en: "All", bn: "সব" },
  "stock.count_summary": {
    en: "{count} phones · Total Value ৳{total}",
    bn: "{count}টি ফোন · মোট মূল্য ৳{total}",
  },
  "stock.download_pdf": { en: "Download PDF", bn: "PDF ডাউনলোড" },
  "stock.loading": { en: "Loading...", bn: "লোড হচ্ছে..." },
  "stock.no_phones": {
    en: "No phones — buy one from the Buy button below",
    bn: "কোনো ফোন নেই — নিচের Buy বাটন থেকে ফোন ক্রয় করুন",
  },
  "stock.bought_from_inline": {
    en: " · from {name}",
    bn: " · {name} থেকে",
  },
  "stock.sell_button": { en: "Sell", bn: "বিক্রি করুন" },
  "stock.delete_phone_aria": { en: "Delete phone", bn: "ফোন ডিলেট করুন" },
  "stock.view_bill_aria": { en: "View bill", bn: "বিল দেখুন" },
  "stock.view_due_aria": { en: "View due", bn: "বাকি দেখুন" },
  "stock.return_phone_aria": { en: "Return phone", bn: "ফোন ফেরত নিন" },
  "stock.print_sticker_aria": { en: "Print sticker", bn: "স্টিকার প্রিন্ট" },
  "stock.used_phone_badge": { en: "Used Phone", bn: "ইউজড ফোন" },
  "stock.sell_sheet_title_prefix": { en: "Sell — ", bn: "বিক্রি — " },
  "stock.selling_price_label": { en: "Selling Price (৳)", bn: "বিক্রয়মূল্য (৳)" },
  "stock.selling_date_label": { en: "Selling Date", bn: "বিক্রয়ের তারিখ" },
  "stock.ram_rom_label": { en: "RAM/ROM (optional)", bn: "RAM/ROM (ঐচ্ছিক)" },
  "stock.battery_health_label": { en: "Battery Health (optional)", bn: "Battery Health (ঐচ্ছিক)" },
  "stock.ram_rom_placeholder": { en: "e.g. 4/64 GB", bn: "যেমন: 4/64 GB" },
  "stock.battery_health_placeholder": { en: "e.g. 92%", bn: "যেমন: 92%" },
  "stock.customer_name_label": { en: "Customer Name", bn: "কাস্টমারের নাম" },
  "stock.customer_phone_label": { en: "Customer Phone Number", bn: "কাস্টমারের ফোন নম্বর" },
  "stock.customer_address_label": { en: "Customer Address (optional)", bn: "কাস্টমারের ঠিকানা (ঐচ্ছিক)" },
  "stock.customer_email_label": { en: "Customer Email (optional)", bn: "কাস্টমারের ইমেইল (ঐচ্ছিক)" },
  "stock.narration_label": { en: "Narration / Note (optional)", bn: "মন্তব্য / নোট (ঐচ্ছিক)" },
  "stock.narration_placeholder": { en: "e.g. Box included, no charger", bn: "যেমন: বক্স আছে, চার্জার নেই" },
  "stock.due_sale_label": { en: "Due Sale", bn: "বাকি বিক্রি (Due)" },
  "stock.paid_now_label": {
    en: "How much paid now (advance, 0 if none)",
    bn: "এখন কত টাকা দিলো (অগ্রিম, না দিলে ০)",
  },
  "stock.saving": { en: "Saving...", bn: "সেভ হচ্ছে..." },
  "stock.confirm_sell_and_bill": {
    en: "Confirm Sell & Generate Bill",
    bn: "বিক্রি নিশ্চিত করুন ও বিল বানান",
  },
  "stock.sticker_sheet_title": { en: "Barcode Sticker", bn: "বারকোড স্টিকার" },
  "stock.print_sticker_button": { en: "Print Sticker", bn: "স্টিকার প্রিন্ট করুন" },
  "stock.buy_price_label": { en: "Buy Price", bn: "ক্রয়মূল্য" },
  "stock.buy_date_label": { en: "Buy Date", bn: "ক্রয়ের তারিখ" },
  "stock.edit_button": { en: "Edit", bn: "এডিট" },
  "stock.sale_info_heading": { en: "Sale Info", bn: "বিক্রির তথ্য" },
  "stock.selling_price_short": { en: "Selling Price", bn: "বিক্রয়মূল্য" },
  "stock.selling_date_short": { en: "Selling Date", bn: "বিক্রয়ের তারিখ" },
  "stock.customer_label": { en: "Customer", bn: "কাস্টমার" },
  "stock.number_label": { en: "Number", bn: "নম্বর" },
  "stock.due_remaining_label": { en: "Due Remaining", bn: "বাকি আছে" },
  "stock.bill_button": { en: "Bill", bn: "বিল" },
  "stock.due_button": { en: "Due", bn: "বাকি" },
  "stock.return_button": { en: "Return", bn: "রিটার্ন" },
  "stock.return_confirm": {
    en: "{model} — take this phone back into stock?",
    bn: "{model} — এই ফোনটি ফেরত নিয়ে স্টকে যোগ করবেন?",
  },
  "stock.delete_confirm": {
    en: "{model} (IMEI: {imei}) — permanently delete this phone from stock? This can't be undone.",
    bn: "{model} (IMEI: {imei}) — এই ফোনটি স্টক থেকে সম্পূর্ণ মুছে ফেলতে চান? এটি ফিরিয়ে আনা যাবে না।",
  },
  "stock.invalid_amount": { en: "Enter a valid amount", bn: "বৈধ পরিমাণ দিন" },
  "stock.due_sheet_title_prefix": { en: "Due Account — ", bn: "বাকি হিসাব — " },
  "stock.total_selling_price_label": { en: "Total Selling Price", bn: "মোট বিক্রয়মূল্য" },
  "stock.customer_prefix": { en: "Customer: ", bn: "কাস্টমার: " },
  "stock.how_much_paid_label": { en: "How much was paid", bn: "কত টাকা পরিশোধ হলো" },
  "stock.add_payment_button": { en: "Add Payment", bn: "পরিশোধ যোগ করুন" },
  "stock.fully_paid": { en: "Fully paid ✓", bn: "সম্পূর্ণ পরিশোধ হয়ে গেছে ✓" },
  "stock.edit_required_fields": {
    en: "Model, IMEI and Buy Price are required",
    bn: "Model, IMEI ও Buy Price আবশ্যক",
  },
  "stock.edit_sheet_title_prefix": { en: "Edit — ", bn: "এডিট — " },
  "stock.save_changes_button": { en: "Save Changes", bn: "পরিবর্তন সেভ করুন" },

  // --- dashboard stats ---------------------------------------------------
  "dashboard.total_cash_label": { en: "Total Cash (So Far)", bn: "টোটাল ক্যাশ (এখন পর্যন্ত)" },
  "dashboard.today_sale_label": { en: "Today's Sale", bn: "আজকের সেল" },
  "dashboard.total_buy_label": { en: "Total Buy", bn: "মোট ক্রয়" },
  "dashboard.stock_label": { en: "Stock", bn: "স্টক" },
  "dashboard.month_profit_label": { en: "This Month's Profit", bn: "এই মাসের প্রফিট" },
  "dashboard.total_cash_sheet_title": { en: "Total Cash Breakdown", bn: "টোটাল ক্যাশের হিসাব" },
  "dashboard.loading": { en: "Loading...", bn: "লোড হচ্ছে..." },
  "dashboard.cash_in_heading": { en: "Added (Cash In)", bn: "যা যোগ হয়েছে (ক্যাশ ইন)" },
  "dashboard.sales_received_label": { en: "Money from Sales", bn: "সেল থেকে পাওয়া টাকা" },
  "dashboard.cash_out_heading": { en: "Subtracted (Cash Out)", bn: "যা বিয়োগ হয়েছে (ক্যাশ আউট)" },
  "dashboard.total_buy_stock_label": { en: "Total Buy (Stock)", bn: "মোট ক্রয় (স্টক)" },
  "dashboard.total_expense_label": { en: "Total Expense", bn: "মোট খরচ" },
  "dashboard.manual_adjustment_heading": { en: "Manual Adjustment", bn: "ম্যানুয়াল এডজাস্টমেন্ট" },
  "dashboard.settings_adjustment_label": { en: "Corrected from Settings", bn: "সেটিংস থেকে ঠিক করা হয়েছে" },
  "dashboard.total_cash_label_short": { en: "Total Cash", bn: "টোটাল ক্যাশ" },
  "dashboard.data_load_failed": { en: "Could not load data", bn: "তথ্য লোড করা যায়নি" },
  "dashboard.today_sale_sheet_title": { en: "Today's Sale Breakdown", bn: "আজকের সেলের হিসাব" },
  "dashboard.no_sales_today": { en: "No sales yet today", bn: "আজ এখনো কোনো সেল হয়নি" },
  "dashboard.today_total_label": { en: "Today's Total", bn: "আজকের মোট" },
  "dashboard.total_buy_sheet_title": { en: "Total Buy Breakdown", bn: "মোট ক্রয়ের হিসাব" },
  "dashboard.in_stock_unsold_label": { en: "In Stock (Unsold)", bn: "স্টকে আছে (Unsold)" },
  "dashboard.sold_label": { en: "Sold", bn: "বিক্রি হয়েছে (Sold)" },
  "dashboard.month_profit_sheet_title": { en: "This Month's Profit Breakdown", bn: "এই মাসের প্রফিটের হিসাব" },
  "dashboard.profit_added_heading": { en: "Added (Profit)", bn: "যা যোগ হয়েছে (লাভ)" },
  "dashboard.stock_profit_month_label": {
    en: "Stock Profit (from this month's sales)",
    bn: "স্টক প্রফিট (এই মাসের সেল থেকে)",
  },
  "dashboard.expense_deducted_heading": {
    en: "Subtracted (Expenses, by Category)",
    bn: "যা বিয়োগ হয়েছে (খরচ, খাত অনুযায়ী)",
  },
  "dashboard.no_expense_entries_month": { en: "No expense entries this month", bn: "এই মাসে কোনো খরচ এন্ট্রি নেই" },
  "dashboard.net_profit_month_label": { en: "Net Profit (This Month)", bn: "নিট প্রফিট (এই মাসে)" },
  "dashboard.sub_title_stock_profit_month": { en: "Stock Profit Details (This Month)", bn: "স্টক প্রফিটের ডিটেইলস (এই মাসে)" },
  "dashboard.sub_title_cash_sales_paid": { en: "Money from Sales — Details", bn: "সেল থেকে পাওয়া টাকার ডিটেইলস" },
  "dashboard.no_stock_sales_month": { en: "No stock sales this month", bn: "এই মাসে কোনো স্টক সেল নেই" },
  "dashboard.no_sale_entries": { en: "No sale entries", bn: "কোনো সেল এন্ট্রি নেই" },
  "dashboard.no_entries": { en: "No entries", bn: "কোনো এন্ট্রি নেই" },
  "dashboard.download_pdf": { en: "Download PDF", bn: "PDF ডাউনলোড" },
  "sidebar.approvals": { en: "Approvals", bn: "অনুমোদন" },
  "sidebar.my_requests": { en: "My Requests", bn: "আমার অনুরোধ" },
  "approvals.title": { en: "Approvals", bn: "অনুমোদন" },
  "approvals.subtitle": { en: "Review changes the POS Manager submitted", bn: "পজ ম্যানেজারের জমা দেওয়া পরিবর্তনগুলো পর্যালোচনা করুন" },
  "approvals.my_title": { en: "My Requests", bn: "আমার অনুরোধ" },
  "approvals.my_subtitle": { en: "Track the status of your submitted changes — this updates automatically once the admin reviews them", bn: "আপনার জমা দেওয়া পরিবর্তনগুলোর অবস্থা এখানে দেখুন — এডমিন রিভিউ করলেই এটা স্বয়ংক্রিয়ভাবে আপডেট হয়ে যাবে" },
  "approvals.empty": { en: "No pending requests", bn: "কোনো মুলতুবি অনুরোধ নেই" },
  "approvals.loading": { en: "Loading...", bn: "লোড হচ্ছে..." },
  "approvals.requested_by_prefix": { en: "Requested by ", bn: "অনুরোধ করেছেন " },
  "approvals.reviewed_by_prefix": { en: "Reviewed by ", bn: "পর্যালোচনা করেছেন " },
  "approvals.action_edit": { en: "Edit", bn: "এডিট" },
  "approvals.action_delete": { en: "Delete", bn: "ডিলিট" },
  "approvals.action_buy": { en: "Buy", bn: "কেনা" },
  "approvals.resource_phone": { en: "Stock (Phone)", bn: "স্টক (ফোন)" },
  "approvals.resource_sale": { en: "Sale", bn: "বিক্রয়" },
  "approvals.resource_expense_category": { en: "Expense Category", bn: "খরচের ঘর" },
  "approvals.resource_expense": { en: "Expense", bn: "খরচ" },
  "approvals.resource_gadget": { en: "Gadget", bn: "গ্যাজেট" },
  "approvals.approve_button": { en: "Approve", bn: "অনুমোদন করুন" },
  "approvals.reject_button": { en: "Reject", bn: "বাতিল করুন" },
  "approvals.approve_confirm": { en: "Approve this change? It will be applied immediately.", bn: "এই পরিবর্তনটি অনুমোদন করবেন? এটি সাথে সাথে কার্যকর হবে।" },
  "approvals.reject_confirm": { en: "Reject this request? It will not be applied.", bn: "এই অনুরোধটি বাতিল করবেন? এটি কার্যকর হবে না।" },
  "approvals.approve_failed": { en: "Could not approve", bn: "অনুমোদন করা যায়নি" },
  "approvals.reject_failed": { en: "Could not reject", bn: "বাতিল করা যায়নি" },
  "approvals.pending_tab": { en: "Pending", bn: "মুলতুবি" },
  "approvals.history_tab": { en: "History", bn: "ইতিহাস" },
  "approvals.status_approved": { en: "Approved", bn: "অনুমোদিত" },
  "approvals.status_rejected": { en: "Rejected", bn: "বাতিল হয়েছে" },
  "approvals.pending_submitted_message": { en: "This change has been submitted for admin approval. It will take effect once approved.", bn: "এই পরিবর্তনটি এডমিনের অনুমোদনের জন্য জমা দেওয়া হয়েছে। অনুমোদন পেলে এটি কার্যকর হবে।" },
  "settings.pos_manager_heading": { en: "POS Manager", bn: "পজ ম্যানেজার" },
  "settings.pos_manager_description": { en: "Create a restricted staff login. A POS Manager can Sell and add entries freely, but any Edit, Delete, or Buy needs your approval first.", bn: "একটা সীমিত স্টাফ লগইন তৈরি করুন। পজ ম্যানেজার স্বাধীনভাবে বিক্রি করতে ও এন্ট্রি করতে পারবে, কিন্তু কোনো Edit, Delete বা Buy করতে হলে আগে আপনার অনুমোদন লাগবে।" },
  "settings.pos_manager_exists_label": { en: "Current POS Manager: ", bn: "বর্তমান পজ ম্যানেজার: " },
  "settings.pos_manager_none": { en: "No POS Manager set up yet", bn: "এখনো কোনো পজ ম্যানেজার সেট আপ করা হয়নি" },
  "settings.pos_manager_username_label": { en: "Username", bn: "ইউজারনেম" },
  "settings.pos_manager_password_label": { en: "Password", bn: "পাসওয়ার্ড" },
  "settings.pos_manager_save_button": { en: "Save POS Manager", bn: "পজ ম্যানেজার সেভ করুন" },
  "settings.pos_manager_remove_button": { en: "Remove POS Manager", bn: "পজ ম্যানেজার সরান" },
  "settings.pos_manager_remove_confirm": { en: "Remove the POS Manager account? They will be logged out immediately.", bn: "পজ ম্যানেজার একাউন্টটি সরিয়ে দেবেন? তাকে সাথে সাথে লগ আউট করা হবে।" },
  "settings.pos_manager_saved": { en: "POS Manager saved", bn: "পজ ম্যানেজার সেভ হয়েছে" },
  "settings.pos_manager_removed": { en: "POS Manager removed", bn: "পজ ম্যানেজার সরানো হয়েছে" },
  "settings.pos_manager_username_password_required": { en: "Enter a username and password", bn: "একটা ইউজারনেম ও পাসওয়ার্ড দিন" },

  "settings.whatsapp_label": { en: "Message us on WhatsApp", bn: "হোয়াটসঅ্যাপে মেসেজ করুন" },

  "settings.shop_info_heading": { en: "Shop / Invoice Info", bn: "শপ / মেমো তথ্য" },
  "settings.shop_info_description": { en: "These details appear on the printed Sales Invoice memo.", bn: "এই তথ্যগুলো প্রিন্ট করা Sales Invoice মেমোর উপরে দেখা যাবে।" },
  "settings.shop_name_label": { en: "Shop Name", bn: "শপের নাম" },
  "settings.shop_address_label": { en: "Address (optional)", bn: "ঠিকানা (ঐচ্ছিক)" },
  "settings.shop_phone_label": { en: "Phone (optional)", bn: "ফোন নম্বর (ঐচ্ছিক)" },
  "settings.shop_email_label": { en: "Email (optional)", bn: "ইমেইল (ঐচ্ছিক)" },
  "settings.shop_info_save_button": { en: "Save Shop Info", bn: "শপের তথ্য সেভ করুন" },
  "settings.shop_info_saved": { en: "Shop info saved", bn: "শপের তথ্য সেভ হয়েছে" },

  "settings.loading": { en: "Loading...", bn: "লোড হচ্ছে..." },
  "settings.backup_heading": { en: "Data Backup", bn: "ডেটা ব্যাকআপ" },
  "settings.backup_description": {
    en: "Download every purchase, sale, expense and gadget record as one file, any time -- and see the automatic weekly copies once those are set up.",
    bn: "সব ক্রয়, বিক্রয়, খরচ ও গ্যাজেটের তথ্য একটা ফাইলে যেকোনো সময় ডাউনলোড করুন -- আর সেটআপ করা থাকলে সাপ্তাহিক অটো ব্যাকআপগুলোও এখানে দেখা যাবে।",
  },
  "settings.backup_download_now": { en: "Download Full Backup Now", bn: "এখনই ফুল ব্যাকআপ ডাউনলোড করুন" },
  "settings.backup_downloading": { en: "Preparing...", bn: "তৈরি হচ্ছে..." },
  "settings.backup_failed": { en: "Could not create the backup", bn: "ব্যাকআপ তৈরি করা যায়নি" },
  "settings.backup_auto_heading": { en: "Weekly Automatic Backups", bn: "সাপ্তাহিক অটোমেটিক ব্যাকআপ" },
  "settings.backup_auto_not_configured": {
    en: "Not set up yet -- ask your developer to finish the one-time weekly-backup setup (see the project notes).",
    bn: "এখনো সেটআপ করা হয়নি -- ডেভেলপারকে সাপ্তাহিক ব্যাকআপের একবারের সেটআপটা শেষ করতে বলুন (প্রজেক্ট নোট দেখুন)।",
  },
  "settings.backup_auto_none": { en: "No automatic backups yet", bn: "এখনো কোনো অটো ব্যাকআপ নেই" },
  "settings.backup_download_button": { en: "Download", bn: "ডাউনলোড" },
};

const LanguageContext = createContext<{
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string) => string;
}>({
  lang: "en",
  setLang: () => {},
  t: (key) => STRINGS[key]?.en ?? key,
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("lang");
      if (saved === "bn" || saved === "en") setLangState(saved);
    } catch {}
  }, []);

  function setLang(l: Lang) {
    setLangState(l);
    try {
      window.localStorage.setItem("lang", l);
    } catch {}
  }

  function t(key: string) {
    const entry = STRINGS[key];
    if (!entry) return key;
    return entry[lang];
  }

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLang() {
  return useContext(LanguageContext);
}
