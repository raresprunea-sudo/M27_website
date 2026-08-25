# M27 Eyewear — How the Website Works

*A plain-language guide for the team. No technical background required.*

---

## PART 1 — WHAT HAPPENS WHEN SOMEONE BUYS

### The journey from ad to doorstep

Think of our website as a shop on a high street. Instagram is the window display — it shows people an ad, and when they tap it, they walk through the front door. Everything after that tap happens automatically, with no human involved, unless something goes wrong.

Here is what happens at each step.

---

**Step 1 — The customer clicks the ad**

The ad runs on Instagram or Facebook. When someone taps it, they are sent straight to our homepage (m27.ro). The ad tracking system — called the Meta Pixel — notes that someone arrived from an ad. This helps us later calculate whether the ad was worth the money.

**Step 2 — Browsing and choosing**

The customer looks through the collection, clicks on a model, picks a colour, and taps "Adaugă în coș" (Add to cart). Nothing is reserved or locked at this point. We have not made a sale yet. The choice is saved temporarily in their phone or computer — specifically, in a little piece of storage called localStorage, which you can think of as a sticky note inside the browser. If they close the tab and come back, their cart is still there.

**Step 3 — Reviewing the cart**

The cart page shows all chosen items, the bundle discount (if they have two or more items — every second one is 50% off), and shipping (19.99 RON, or free if the net total after discount is 300 RON or more). The figures shown here should match checkout exactly.

**Step 4 — Checkout**

The customer fills in their name, email, phone, and delivery address. They then choose how to pay: by card or by ramburs (cash on delivery). This is where the two paths split.

---

### PATH A — Paying by card

**Step 5A — Entering card details**

The card input is powered by Stripe (our payment processor — more on it in Part 2). The customer never types their card number into our site directly. Instead, Stripe provides a secure little box embedded in our checkout page. The card data goes straight to Stripe's servers, not ours. We never see or store card numbers.

**Step 6A — Stripe checks and charges the card**

When the customer taps "Plătește X RON", the amount is sent to Stripe. Stripe contacts the customer's bank, runs fraud checks, and either approves or declines the payment. If the bank requires an extra verification step (like a one-time code sent to the customer's phone — known as 3D Secure), Stripe handles that automatically.

**Step 7A — The customer is sent to the confirmation page**

If the payment succeeds, Stripe sends the customer's browser to our confirmation page (m27.ro/confirmation.html). The page reads a secret code from Stripe to confirm the payment was real, then creates the order record in our database.

**Step 8A — Stripe tells our system (the webhook)**

At almost the same moment, Stripe sends a private notification — called a webhook — directly to our server, like a phone call from Stripe saying "payment received." This is the most reliable signal we have. Our server uses this to:
- Reduce the stock count for the purchased item
- Send the customer a confirmation email via our email service, Resend

The webhook and the confirmation page act as a double check. If the customer closed their browser before the confirmation page loaded, the webhook still fires and the stock still updates.

**Step 9A — Customer receives email**

A few seconds later, the customer receives a confirmation email from comenzi@m27.ro with their order details, the order reference number, and a note about delivery timing.

---

### PATH B — Paying by ramburs (cash on delivery)

**Step 5B — No payment taken now**

The customer selects "Ramburs" and taps "Plasează comanda." No card details are required. No money changes hands at this point.

**Step 6B — Our system creates the order immediately**

Because there is no payment to wait for, our server creates the order record right away (marked as "pending"), reduces the stock for the chosen items, and sends the confirmation email — all in one go, in under two seconds.

**Step 7B — Customer is sent to the confirmation page**

The customer sees the same confirmation page as with a card payment, with their order reference number.

**Step 8B — Courier contact**

We (or our courier partner, Sameday) contact the customer before delivery. They pay cash when the package arrives. The order status in our admin panel stays as "pending" until we mark it otherwise.

---

### What can go wrong

- **Card declined:** The customer sees an error message from Stripe and can try again with a different card. Nothing is ordered, no stock is reduced.
- **Payment succeeded but customer closed browser immediately:** The webhook fires regardless. The order is created and stock is reduced. The customer gets their email. The order appears in the admin panel. No action needed.
- **Email not received:** The order still exists in the database. See Part 6 for the troubleshooting steps.
- **Customer places a ramburs order but refuses delivery:** The order stays in the system. Stock has already been reduced. We must manually revert the stock in the admin panel.

---

## PART 2 — THE TOOLS WE USE AND WHY

---

### Vercel — The building where our website lives

**What it does:** Vercel hosts our website. Think of it as the physical building that our shop operates out of. When someone types m27.ro in a browser, their request travels to Vercel's servers, which send back our website pages.

Vercel also runs the background code that handles orders, payments, and emails. These are small programs that run only when triggered — like a cashier who appears only when a customer is at the till, rather than standing there all day.

**Why we need it:** Without Vercel, the website would not be accessible to anyone.

**What breaks if it goes down:** Everything. The site would show an error. This is very rare — Vercel has an uptime record of over 99.9%.

**Cost:** Currently free on the Hobby plan. When monthly order volume grows or we need more processing power, we would upgrade to the Pro plan, which costs around $20/month.

---

### GitHub — The filing cabinet for the website's code

**What it does:** GitHub stores every version of the website's code, with a full history of every change ever made. Think of it like a filing cabinet where every draft of a document is kept — you can always go back to an earlier version.

**Why we need it:** If a developer accidentally breaks something, they can revert to a previous version in minutes. It also lets multiple developers work on the site without overwriting each other's work.

**What breaks if it goes down:** Existing visitors are unaffected — the website keeps running. Developers cannot push new changes until GitHub is back. Outages are extremely rare.

**Cost:** Free for our use case.

---

### Supabase — Our database (the filing system for orders and products)

**What it does:** Supabase is where we store all our data: product stock levels, every order ever placed, every newsletter signup. Think of it as a giant, organised spreadsheet that our website reads and writes to in real time.

When a customer buys something, a new row is added to the "orders" table. When stock is reduced, the number in the "products" table is updated. The admin panel reads from this same database to show you the order list.

**Why we need it:** Without Supabase, we would have no memory. We would not know who ordered what, how much stock we have, or what emails to send.

**What breaks if it goes down:** Orders cannot be created. Stock cannot be updated. The admin panel would not load. This is very rare — Supabase is built on major cloud infrastructure. If it does happen, Stripe's webhook will retry, so no orders are lost.

**Cost:** Free up to 500 MB of data and 50,000 monthly requests — comfortably covers early operations. Paid plans start at $25/month and would only be needed at significant scale.

---

### Stripe — The card payment machine

**What it does:** Stripe handles everything to do with card payments. Think of it as the card terminal at a physical till — the customer taps their card, Stripe talks to their bank, and money moves. We never see or store card numbers; Stripe does all of that under their own security.

Stripe also supports Apple Pay and Google Pay automatically when the customer's device is set up for them.

**Why we need it:** We cannot accept card payments without a payment processor. Stripe is the industry standard and is trusted by millions of businesses.

**What breaks if it goes down:** Card payments are unavailable. Ramburs orders still work fine. Stripe's uptime is historically above 99.99%. They have a public status page at status.stripe.com.

**Cost:** No monthly fee. Stripe takes approximately 1.4% + 0.25 EUR per successful card transaction for European cards (the rate for non-European cards is slightly higher). This is deducted before funds are paid out to our bank account, so we never write a separate cheque to Stripe.

---

### Resend — The system that sends confirmation emails

**What it does:** When an order is placed, our system uses Resend to send the confirmation email to the customer. Resend is a specialist email delivery service — it is better at reaching inboxes than a regular email account, because it has agreements with major email providers to ensure messages are not marked as spam.

**Why we need it:** Sending emails reliably from a business address is harder than it sounds. A regular Gmail or Yahoo account would get flagged as spam quickly. Resend handles authentication (proving the email really comes from m27.ro) so our emails consistently reach customers.

**What breaks if it goes down:** Customers do not receive their confirmation email. The order still exists in the database — no orders are lost. We would need to contact affected customers manually or wait for Resend to recover.

**Cost:** Free up to 3,000 emails per month. At current transaction volumes this is plenty. Paid plans start at $20/month.

---

### Google Analytics (GA4) — The visitor counter and behaviour tracker

**What it does:** GA4 counts how many people visit the site, how long they stay, which pages they look at, where they came from, and whether they completed a purchase. Think of it as a security camera that counts footfall and tracks which shelves people look at — for the purpose of understanding the business, not surveillance.

**Why we need it:** Without analytics, we are flying blind on marketing decisions. We cannot know which ads drive sales, or which pages make people leave.

**What breaks if it goes down:** The site keeps working normally. We just stop collecting data for that period. Historic data is preserved.

**Important note on consent:** GA4 only loads if a visitor clicks "Acceptă" (Accept) on the cookie consent banner. If they decline, we collect no data about them. This is a legal requirement under GDPR and is built into the site already.

**Cost:** Free.

---

### Meta Pixel and Ads Manager — The connection between our website and our ads

**What it does:** The Meta Pixel is a small piece of code on our website that signals back to Facebook and Instagram when someone visits, views a product, or completes a purchase. Ads Manager is the interface in Facebook Business Manager where we create and manage ads.

The Pixel is what allows Facebook to measure whether someone who saw our ad later bought something. It also powers retargeting — showing ads to people who visited but did not buy.

**Why we need it:** Without the Pixel, we cannot measure ad performance accurately or run retargeting campaigns. Our ad spend would be partly wasted because we could not tell which campaigns were working.

**What breaks if it goes down:** Ads keep running but performance data stops flowing in. We would see gaps in reporting in Ads Manager.

**Important note on consent:** Like GA4, the Meta Pixel only loads after a visitor accepts cookies.

**Cost:** The Pixel itself is free. Ad spend is charged directly to our Facebook Ads account.

---

### Claus Web — The signpost that points m27.ro at our website

**What it does:** When someone types m27.ro into their browser, the internet needs to know which server to send them to. Claus Web manages those directions (called DNS records). Think of it as the directory service that knows our address — it tells anyone looking for m27.ro to go to Vercel's servers.

**Why we need it:** Without correct DNS settings, our domain would point nowhere and the site would be unreachable even if Vercel is working perfectly.

**What breaks if it goes down or settings are changed incorrectly:** The entire site becomes unreachable. Changes to DNS take up to 24 hours to propagate globally, so fixing a misconfiguration is not instant.

**Cost:** Included in our domain registration fee.

---

### Sameday — The courier

**What it does:** Sameday is our delivery partner. Once we hand packages to them, they deliver to the customer's home address or a locker near the customer. For locker deliveries, we assign the nearest locker to the customer's address and communicate it to them by email or SMS before delivery.

**Why we need it:** We need a reliable courier with nationwide coverage in Romania that integrates with modern e-commerce.

**What breaks if there is a problem:** Packages can be delayed or lost. This is a customer service issue handled outside the website. The site itself is unaffected.

**Cost:** Charged per shipment. Rates depend on the contract negotiated with Sameday.

---

### GoMag — Our previous platform (being retired)

GoMag was the e-commerce platform we used before building this custom site. Think of it as renting a shop in a mall — convenient but limited. We could not customise the design or the purchasing experience beyond what GoMag allowed.

We are retiring GoMag in favour of this custom site, which we own and control entirely. Old product links from GoMag's domain (m27shop.ro) are being replaced. There is nothing to manage in GoMag going forward; if you see old references to it, they can be ignored.

---

## PART 3 — THE ADMIN PANEL

### Where it lives and how to log in

The admin panel is at: **m27.ro/admin27.html**

Do not share this address publicly. When you open it, you will see a login screen. Enter the admin password — this is the password set in the system settings, which only the technical team holds. If you do not know it, ask the person who set up the site.

If you enter the wrong password, the screen shakes and shows an error. Try again. After a correct password, the admin panel loads.

---

### What you can do in the admin panel

**Orders screen (the default view)**

This shows a list of every order, newest first. For each order you can see:
- The order reference number
- The customer's name and email
- The delivery address
- Payment method (card or ramburs)
- Total amount
- Current status (pending, paid, processing, shipped, delivered, cancelled, refunded)

**Daily task — checking new orders:**
1. Open m27.ro/admin27.html and log in.
2. The order list loads automatically. New orders appear at the top.
3. Ramburs orders arrive with status "pending." Card orders arrive with status "paid."

**Daily task — marking an order as shipped:**
1. Find the order in the list.
2. Click on the order to expand its details.
3. Find the status dropdown.
4. Change the status to "shipped."
5. Click Save. The change is saved immediately.

**Products screen**

This shows every product variant (each model + colour combination) with its current stock number.

**Daily task — updating stock when a model sells out:**
1. Click the "Products" tab in the admin panel.
2. Find the product variant that is low or out of stock.
3. Click the stock number, type the new quantity (for example, if you added 10 units to the warehouse, enter the new total).
4. Click Save.

**Viewing revenue for the week:**

The admin panel shows key figures at the top: total orders, total revenue, and a breakdown by status. These numbers are live — they update every time you reload the page.

---

### What the admin panel CANNOT do

This is important. The following things do **not** exist as buttons or settings in the admin panel. They require a developer to change the code:

- Adding a new product model or colour variant
- Changing the price (currently 175 RON for every model)
- Changing the bundle discount percentage or threshold
- Changing the free shipping threshold (currently 300 RON)
- Changing the shipping fee (currently 19.99 RON)
- Uploading or swapping product photos
- Editing any text on the website (product names, descriptions, page copy)
- Adding or removing pages
- Changing the design of any page

If someone on the team spends time looking for any of these settings, they will not find them. The rule of thumb: if it involves words, images, or prices that a customer sees — it is in the code.

---

## PART 4 — WHERE THE DATA LIVES

### Products

Stored in Supabase, in a table called "products." Each row is one variant — one model in one colour. It contains the model name, colour, price, current stock level, and a flag for whether it is active (visible to customers). Inactive products are hidden from the website automatically.

### Orders

Stored in Supabase, in a table called "orders." Each row represents one customer order. A related table called "order_items" stores exactly what was ordered (which model, which colour, how many, at what price). These records are permanent — nothing is ever deleted.

### Customers

We do not have a separate "customer accounts" system. Customer information (name, email, phone, address) is stored only as part of each order record. We do not ask customers to create passwords or profiles.

### Newsletter signups

Stored in Supabase, in a table called "subscribers." Each row is one email address and the date it was added. Submitting the same email twice does not create a duplicate.

### Who can see this data

- The Supabase database is accessible only to team members who have the Supabase account credentials.
- The admin panel shows orders to anyone with the admin password.
- No customer data is exposed publicly on the website.

### GDPR and customer data

GDPR (the General Data Protection Regulation) is European law that gives people rights over their personal data. In practice, for us, this means:

- We collect only what we need to fulfill an order: name, email, phone, address.
- We must be able to delete a customer's data if they ask us to. Currently this requires manually deleting their order records from Supabase. A developer can do this in under five minutes.
- We must not sell or share customer data with third parties except our logistics partner (Sameday) and email provider (Resend), who process it only to fulfill delivery and send the confirmation email.
- Our privacy policy (m27.ro/privacy.html) explains this to customers. It must be kept up to date.
- Cookie consent is already implemented: tracking (GA4, Meta Pixel) only activates after explicit acceptance.

If a customer emails asking to have their data deleted, treat it as urgent and contact a developer the same day.

---

## PART 5 — WHAT NEEDS A DEVELOPER

The following changes require editing the code. They cannot be done through the admin panel or any settings screen. Use this list to know when to contact a developer instead of searching for a button that does not exist.

| What you want to change | Estimated effort |
|---|---|
| Change the price of any product | Minutes |
| Change the shipping cost (19.99 RON) | Minutes |
| Change the free-shipping threshold (300 RON) | Minutes |
| Change the bundle discount percentage | Minutes |
| Edit any text on any page | Minutes to 1 hour depending on scope |
| Add a new product colour to an existing model | 30 minutes (code + Supabase row) |
| Add a completely new product model | Several hours (photos, code, database) |
| Add or remove a page | 1–4 hours |
| Change the header navigation links | Minutes |
| Change any colour, font, or spacing in the design | Minutes to hours |
| Swap a product photo | 15–30 minutes |
| Add a new payment method | Days |
| Add a locker picker (letting customers choose their Sameday locker) | 1–2 days |
| Add customer accounts / login system | Several days |
| Add a discount code system | 1–2 days |
| Add a new language (Romanian or others) | Several days |
| Delete a customer's data (GDPR request) | Minutes |
| Integrate a new courier | Days |

---

## PART 6 — WHEN SOMETHING GOES WRONG

### "A customer says they paid but received no confirmation email"

**What probably happened:** The email was marked as spam, or there was a brief delay from our email provider (Resend).

**Where to look first:**
1. Ask the customer to check their spam/junk folder. The email comes from comenzi@m27.ro.
2. Open the admin panel (m27.ro/admin27.html) and find the order. If it is there, the payment went through. You can note the order reference and reply to the customer manually.
3. Log in to Resend (resend.com) with your team credentials and check the email logs — it will show whether the email was sent successfully and whether it bounced.

**When to escalate:** If the order appears in the admin panel but nothing appears in Resend's log, call a developer.

---

### "The site won't load at all"

**What probably happened:** One of three things — Vercel is having a problem, our domain settings (Claus Web) have been changed, or there is a billing issue with one of our services.

**Where to look first:**
1. Try opening the site on a different device or internet connection. If it loads on another device, the problem is local (the visitor's internet, not our site).
2. Check Vercel's status page: vercel-status.com
3. Check that no one on the team has recently changed domain settings in Claus Web.
4. Check whether Vercel's account is in good standing.

**When to escalate:** If the site is down on multiple devices and Vercel shows no reported issues, call a developer immediately.

---

### "An order is missing from the admin panel"

**What probably happened:** For card payments — the customer's payment failed before completing, so no order was created. For ramburs — there may be a database connection issue.

**Where to look first:**
1. If it was a card payment, log in to Stripe (dashboard.stripe.com) and search for the customer's email or the amount. You can see whether a payment was attempted and whether it succeeded.
2. If Stripe shows a successful payment but no order appears in the admin panel, this is a developer-level issue.

**When to escalate:** Stripe shows "succeeded" but the order is missing from the admin panel — call a developer.

---

### "A customer says they were charged twice"

**What probably happened:** The customer may have clicked the payment button twice, or their bank pre-authorized the amount and then charged it again when the authorization settled.

**Where to look first:**
1. Log in to Stripe and search for the customer's email.
2. Look at the payment history. If there are two separate "succeeded" charges, there is a genuine double charge and you need to issue a refund for one of them through Stripe's dashboard (Payments → find the charge → Refund).
3. If one is "succeeded" and one is "failed" or "pending," there is likely only one real charge and the other will disappear within a few days.

**When to escalate:** If there are two "succeeded" charges but you are unsure which to refund, call a developer before touching anything in Stripe.

---

### "The admin panel won't accept the password"

**What probably happened:** The password was changed, or it is being entered with a typo.

**Where to look first:** Copy-paste the password rather than typing it, to rule out typos. The password is case-sensitive.

**When to escalate:** If you are certain the password is correct and it is still rejected, call a developer — the admin secret environment variable may need to be reset.

---

### "A customer reports their order has the wrong items or price in the confirmation email"

**What probably happened:** This would be a site bug. It has not been observed in testing, but it would mean the cart data at checkout did not match the email data.

**Where to look first:** Open the order in the admin panel and check the items listed there. If they match the email, the email is correct and the customer may be confused. If the admin panel shows different items, escalate.

**When to escalate:** Immediately if the order in the admin panel does not match the confirmation email.

---

## PART 7 — FULL TESTING CHECKLIST

*This section can be run by anyone on the team, on a real device, without technical knowledge. Read the "What you should see" column carefully — anything different means something is wrong.*

---

### A. Pages and Navigation

**A1 — Homepage loads**
- **What to do:** Open m27.ro in a browser. Wait for the page to fully load.
- **What you should see:** The M27 logo appears at the top. A hero section with a headline and product photography. A navigation bar with links. No broken images (grey boxes or "image not found" icons).
- **What it means if wrong:** A blank page or error message means the site is down. A broken image means a photo file is missing.
- **Where to look next:** Check vercel-status.com. Call a developer if Vercel is green.

**A2 — Collection page**
- **What to do:** From the homepage, click "Collections" in the top navigation.
- **What you should see:** A page showing all product models as cards with photos, names, and a button to view each.
- **What it means if wrong:** Broken images or missing models means a photo file path is wrong in the code.
- **Where to look next:** Call a developer.

**A3 — Product page**
- **What to do:** Click on any product card in the collection.
- **What you should see:** A product page with a large photo, the model name, the price (175 RON), colour options, and an "Adaugă în coș" button.
- **What it means if wrong:** Missing price or button means a code error. Missing photo means a file path issue.
- **Where to look next:** Call a developer.

**A4 — Cart page**
- **What to do:** Add a product to the cart. Click the shopping bag icon in the top-right.
- **What you should see:** The cart page shows your item, the quantity, the price, shipping, and a total. The "Cumpără acum" button is visible.
- **What it means if wrong:** Empty cart after adding, or wrong totals, means a cart calculation bug.
- **Where to look next:** Call a developer.

**A5 — Checkout page**
- **What to do:** From the cart, click "Cumpără acum."
- **What you should see:** A checkout form with fields for name, email, phone, address, and payment options.
- **What it means if wrong:** If the page loads but shows no items in the order summary, the cart data was not carried over.
- **Where to look next:** Call a developer.

**A6 — Confirmation page (direct visit)**
- **What to do:** Type m27.ro/confirmation.html directly into the browser address bar.
- **What you should see:** A page with a check icon and a "Thank you" message, but no specific order details (since no order was placed). Two buttons: "Continuă cumpărăturile" and "Pagina principală."
- **What it means if wrong:** An error page or blank screen means the confirmation page has a code fault.
- **Where to look next:** Call a developer.

**A7 — About page**
- **What to do:** Find and click the About link in the footer or navigation.
- **What you should see:** The about page loads with brand story content.
- **What it means if wrong:** A 404 "page not found" error means the link is broken.
- **Where to look next:** Call a developer.

**A8 — Information pages (run for each)**
Open each of the following pages and confirm they load without errors. The URL is m27.ro/ followed by the page name.

| Page | URL |
|---|---|
| Termeni și condiții | /terms.html |
| Confidențialitate | /privacy.html |
| Livrare | /shipping.html |
| Retur | /returns.html |
| Garanție | /warranty.html |
| Metode de plată | /payment-methods.html |
| FAQ | /faq.html |
| Ajutor | /ajutor.html |
| Cum cumpăr | /cum-cumpar.html |

- **What you should see:** Each page loads with readable text. No broken images. Footer is present.
- **What it means if wrong:** A blank page or 404 means the page file is missing or a link is wrong.
- **Where to look next:** Call a developer.

**A9 — Footer links**
- **What to do:** On the homepage, scroll to the footer. Click each link (Termeni, Confidențialitate, Retur, Livrare, Metode de Plată, FAQ, Ajutor).
- **What you should see:** Each link opens the correct page.
- **What it means if wrong:** Wrong page or 404 means the link is incorrectly coded.
- **Where to look next:** Call a developer.

**A10 — Navigation on mobile (phone)**
- **What to do:** Open m27.ro on a phone. Tap the hamburger menu icon (three horizontal lines) in the top-left or top-right.
- **What you should see:** A dropdown menu appears with navigation links. Tapping each link takes you to the correct page.
- **What it means if wrong:** Menu does not open, or links lead to wrong pages.
- **Where to look next:** Call a developer.

---

### B. Products

**B1 — All model pages open**
- **What to do:** From the collection page, click each of the seven models: Sulphur, Selenium, Zirconium, Mercury, Chlorine, Palladium, Titanium. Wait for each page to fully load.
- **What you should see:** Each model page loads with a photo, the model name, "175 RON" as the price, colour options, and the add-to-cart button.
- **What it means if wrong:** A model page that shows a blank photo or a price other than 175 RON is a code error.
- **Where to look next:** Call a developer.

**B2 — Colour switching changes the photo**
- **What to do:** On any model page, click a different colour option (for example, change from "Full Black" to "Skyblue").
- **What you should see:** The main product photo changes to match the selected colour. The colour name below the photo updates.
- **What it means if wrong:** Photo does not change, or the wrong photo appears, or a grey box appears — means a photo file is missing or a colour name in the code does not match exactly.
- **Where to look next:** Call a developer.

**B3 — Price is always 175 RON**
- **What to do:** Open at least three different model pages and check the price shown.
- **What you should see:** "175 RON" on every model page, for every colour.
- **What it means if wrong:** Any other figure is a code error.
- **Where to look next:** Call a developer.

**B4 — Out-of-stock items**
- **What to do:** In the admin panel, set any one product variant to a stock quantity of 0. Then open that product's page on the website.
- **What you should see:** The colour option for that variant should appear greyed out or disabled, and the add-to-cart button should be disabled or not appear for that variant.
- **What it means if wrong:** If an out-of-stock variant can still be added to the cart, customers can order items we cannot ship. This is a critical bug.
- **Where to look next:** Call a developer immediately.

---

### C. Cart

**C1 — Adding a single item**
- **What to do:** Go to any product page. Select a colour. Click "Adaugă în coș."
- **What you should see:** The shopping bag icon in the navigation shows a badge with the number 1. Clicking it opens the cart, which shows the item with the price 175 RON, shipping of 19.99 RON, and a total of **194.99 RON**.
- **What it means if wrong:** Wrong total means the cart calculation is broken.
- **Where to look next:** Call a developer.

**C2 — Bundle discount at two items**
- **What to do:** Add two items to the cart (they can be the same model or different).
- **What you should see:** The cart shows:
  - Subtotal: 350.00 RON (2 × 175)
  - Discount "al 2-lea 50% OFF": −87.50 RON
  - Livrare: 19.99 RON (net is 262.50 RON, which is below the 300 RON free-shipping threshold)
  - **Total: 282.49 RON**
- **What it means if wrong:** If the discount does not appear, or the total is different, the bundle logic is broken.
- **Where to look next:** Call a developer.

**C3 — Free shipping at three items**
- **What to do:** Add three items to the cart.
- **What you should see:**
  - Subtotal: 525.00 RON
  - Discount: −87.50 RON (only one pair discount for three items)
  - Livrare: Gratuit (net is 437.50 RON, which is above 300 RON)
  - **Total: 437.50 RON**
- **What it means if wrong:** If shipping is still charged, the threshold check is broken.
- **Where to look next:** Call a developer.

**C4 — Removing an item**
- **What to do:** In the cart, click "Elimină" next to one of the items.
- **What you should see:** The item disappears. Totals recalculate correctly.
- **What it means if wrong:** Item does not disappear, or totals do not update.
- **Where to look next:** Call a developer.

**C5 — Cart survives a page refresh**
- **What to do:** Add items to the cart. Close the cart page and reopen it (or press F5 to refresh).
- **What you should see:** The cart still contains the same items with the same quantities.
- **What it means if wrong:** If the cart is empty after a refresh, the browser's storage is being cleared incorrectly.
- **Where to look next:** Call a developer.

**C6 — Empty cart state**
- **What to do:** Remove all items from the cart, or go to cart.html with no items added.
- **What you should see:** A message that the cart is empty, and a button to go to the collection.
- **What it means if wrong:** A blank page or an error instead of the empty state message.
- **Where to look next:** Call a developer.

---

### D. Checkout

**D1 — Totals match the cart exactly**
- **What to do:** Add one item to the cart, go to checkout. Note the total shown in the order summary on the right side of the checkout page (or at the top on mobile, under the toggle).
- **What you should see:** The same total as in the cart: **194.99 RON** for one item.
- **What it means if wrong:** If the cart showed one number and checkout shows another, there is a rounding or calculation mismatch.
- **Where to look next:** Call a developer.

**D2 — Two-item total in checkout**
- **What to do:** Add two items, proceed to checkout.
- **What you should see:** Total in checkout: **282.49 RON**, with the discount line visible.
- **What it means if wrong:** Discrepancy between cart and checkout is a bug.
- **Where to look next:** Call a developer.

**D3 — Form validation — empty fields**
- **What to do:** On the checkout page, leave all fields blank and click the submit button ("Plătește X RON" or "Plasează comanda").
- **What you should see:** Error messages appear next to every required field: Prenume, Nume, Email, Stradă, Oraș, Județ, Telefon. The form does not submit.
- **What it means if wrong:** If the form submits with empty fields, invalid orders can be created.
- **Where to look next:** Call a developer.

**D4 — Form validation — invalid email**
- **What to do:** Fill in all fields correctly, but enter "test" (not a real email) in the email field. Click submit.
- **What you should see:** An error appears on the email field saying the email is invalid. No order is placed.
- **What it means if wrong:** Orders placed with invalid emails mean confirmation emails will never be received.
- **Where to look next:** Call a developer.

**D5 — Switching delivery method**
- **What to do:** At checkout, click "Livrare la locker Sameday." Then click "Livrare la domiciliu."
- **What you should see:** The selected option is highlighted with a dark border. The price shown next to each option is the same (19.99 RON). The order summary shipping line updates if applicable.
- **What it means if wrong:** If the selection does not visually change, or if switching changes the price incorrectly, there is a UI bug.
- **Where to look next:** Call a developer.

**D6 — Switching payment method**
- **What to do:** At checkout, click "Ramburs." Watch the payment section. Then click "Card bancar."
- **What you should see:** When Ramburs is selected: the Stripe card input disappears and a note about cash payment appears. The button reads "Plasează comanda." When Card is selected: the Stripe card input reappears and the button reads "Plătește X RON."
- **What it means if wrong:** If the card input is still visible when Ramburs is selected, or the button label does not change, there is a UI bug.
- **Where to look next:** Call a developer.

---

### E. Payment by card — end-to-end test

*Use a real card for a real purchase. This is the only way to fully verify the card path on a live site. Plan to refund the order after testing, using the Stripe dashboard.*

**E1 — Complete a card purchase**
- **What to do:** Add one item to the cart. Proceed to checkout. Fill in your own real name, email, phone, and a real Romanian address. Select "Livrare la domiciliu" and "Card bancar." Enter your real card details in the Stripe payment box. Click "Plătește 194.99 RON."
- **What you should see:** A loading state on the button, then a redirect to the confirmation page. The confirmation page shows a green check, the heading "Mulțumim!", your order reference number (8 characters), and a summary of your order with the correct total.
- **What it means if wrong:** If you see a payment error, Stripe declined the card. If the redirect lands on a blank confirmation page with no order details, the confirmation flow is broken.
- **Where to look next:** For payment errors, check Stripe's dashboard for the reason. For a blank confirmation page, call a developer.

**E2 — Verify in Stripe**
- **What to do:** Log in to dashboard.stripe.com. Go to Payments. Find the payment you just made (search by amount or your email).
- **What you should see:** The payment shows status "Succeeded." The amount is correct. The customer's name and email match what you entered.
- **What it means if wrong:** A "failed" status means the payment did not go through even if the site showed success — call a developer immediately.
- **Where to look next:** Stripe's payment detail page shows a full event timeline.

**E3 — Verify in Supabase (order in database)**
- **What to do:** Log in to app.supabase.com. Open the project. Go to Table Editor → orders. Find the most recent order by looking at the "created_at" column.
- **What you should see:** A row with your name, email, the correct total, delivery_type set to "home," status set to "paid," and a stripe_payment_id starting with "pi_" matching the payment ID in Stripe.
- **What it means if wrong:** If no order row appears, the confirmation page failed to create the order. If status is "pending" instead of "paid," the webhook did not fire correctly.
- **Where to look next:** Check the Stripe webhook logs in the Stripe dashboard (Developers → Webhooks). Call a developer if there are failed events.

**E4 — Verify in the admin panel**
- **What to do:** Open m27.ro/admin27.html. Log in.
- **What you should see:** The order appears at the top of the list with status "paid."
- **What it means if wrong:** Order missing from admin but present in Supabase means the admin panel query is broken.
- **Where to look next:** Call a developer.

**E5 — Verify the confirmation email (exactly one email)**
- **What to do:** Open the inbox for the email address you used during the test purchase. Wait up to two minutes.
- **What you should see:** Exactly **one** email from comenzi@m27.ro with the subject "Confirmare comandă #XXXXXXXX — M27 Eyewear." The email body should show your order reference, the item(s) you ordered, the correct totals, and the delivery address. There should be no second identical email.
- **What it means if wrong:** Two identical emails means the double-send bug has returned — call a developer. No email at all means either Resend failed or the email landed in spam.
- **Where to look next:** Check the spam folder first. Then check the Resend dashboard (resend.com → Logs) to see if the email was sent successfully.

**E6 — Verify stock decreased**
- **What to do:** Before the purchase, note the stock level of the item you are buying in the admin panel. After the purchase, reload the products screen.
- **What you should see:** The stock level has decreased by exactly the quantity you purchased.
- **What it means if wrong:** Stock did not decrease means the Stripe webhook did not fire or failed. The customer got their product but our inventory is wrong.
- **Where to look next:** Stripe dashboard → Developers → Webhooks → look for failed deliveries for the `payment_intent.succeeded` event.

---

### F. Payment by ramburs — end-to-end test

**F1 — Complete a ramburs purchase**
- **What to do:** Add one item to the cart. Proceed to checkout. Fill in real contact details. Select "Ramburs." Click "Plasează comanda."
- **What you should see:** A loading state, then a redirect to the confirmation page showing the order reference and order summary. No payment was taken.
- **What it means if wrong:** Error message on submission — check the error text. If it says "produse nu mai sunt disponibile," the item is out of stock. Any other error, call a developer.
- **Where to look next:** Call a developer if the page does not redirect within 5 seconds.

**F2 — Verify in Supabase**
- **What to do:** Log in to Supabase → Table Editor → orders. Find the new order.
- **What you should see:** A row with your name, email, status "pending," no stripe_payment_id (it should be empty/null), and the correct total.
- **What it means if wrong:** Status "paid" on a ramburs order means something is wrong with the order creation logic. Call a developer.
- **Where to look next:** Call a developer.

**F3 — Verify in admin panel**
- **What to do:** Open the admin panel. Check the top of the order list.
- **What you should see:** The order at the top with status "pending."
- **What it means if wrong:** Order missing from admin panel but present in Supabase — call a developer.

**F4 — Verify the confirmation email**
- **What to do:** Check the inbox of the email you used.
- **What you should see:** One email from comenzi@m27.ro, same format as the card payment email. It should arrive within 30 seconds.
- **What it means if wrong:** No email after two minutes — check the Resend dashboard. Call a developer if the log shows an error.

**F5 — Verify stock decreased**
- **What to do:** Same as E6.
- **What you should see:** Stock decreased immediately when the order was placed (ramburs orders decrement stock at the moment of order creation, not after payment).
- **What it means if wrong:** Stock did not decrease — call a developer. This would allow the same item to be oversold.

---

### G. Apple Pay and Google Pay

These payment options only appear to customers whose devices and browsers support them, AND only on a page served over HTTPS. They are hidden by default and only become visible when appropriate. This is correct behaviour.

**G1 — Test on iPhone (Apple Pay)**
- **What to do:** On an iPhone with a credit card saved in Apple Pay (Wallet app), open Safari and go to m27.ro/checkout.html with an item in the cart.
- **What you should see:** At the top of the checkout form, before the address fields, a button with the Apple Pay logo appears. Tapping it opens the standard Apple Pay sheet with the M27 Eyewear name and total.
- **What it means if wrong:**
  - If the button does not appear: either Apple Pay is not set up on this iPhone (check Wallet app), or the site is being tested over a non-HTTPS connection (should not happen on live site). This is *not* a bug — it is correct hiding behaviour.
  - If the button appears but tapping it shows an error: call a developer.
- **Where to look next:** Check that the iPhone has a card in Apple Pay. If it does and the button is still missing, call a developer.

**G2 — Test on Android (Google Pay)**
- **What to do:** On an Android phone with Google Pay set up (Google Wallet app), open Chrome and go to m27.ro/checkout.html with an item in the cart.
- **What you should see:** A Google Pay button appears at the top of the checkout form.
- **What it means if wrong:** Same logic as Apple Pay — if Google Pay is not set up on the device, the button is correctly hidden. If it is set up and the button is missing, call a developer.
- **Where to look next:** Confirm Google Pay is set up in Google Wallet. If yes and button is still missing, call a developer.

**G3 — Telling the difference between "hidden correctly" and "broken"**
- The button is **correctly hidden** when: the device has no saved payment method, the browser does not support the payment method, or you are not using Safari (for Apple Pay) or Chrome (for Google Pay).
- The button is **broken** when: the device definitely has a saved payment method, you are using the right browser, but the button still does not appear. Call a developer.

---

### H. Stock

**H1 — Stock decreases after a card purchase**
Covered in E6 above.

**H2 — Stock decreases after a ramburs purchase**
Covered in F5 above.

**H3 — Out-of-stock block for card payments**
- **What to do:** In the admin panel, set a specific product variant to 0 stock. Then try to purchase that variant using a card.
- **What you should see:** When you click "Plătește X RON," an error message appears saying the product is unavailable. The payment is not taken. No order is created.
- **What it means if wrong:** If the payment goes through on an out-of-stock item, the stock guard is broken — call a developer immediately.
- **Where to look next:** Call a developer.

**H4 — Out-of-stock block for ramburs orders**
- **What to do:** Same setup (set stock to 0). Try to place a ramburs order.
- **What you should see:** An error message appears after clicking "Plasează comanda" saying the product is unavailable. No order is created.
- **What it means if wrong:** Call a developer immediately.

**H5 — Last unit race condition**
- **What to do:** Set stock to 1. Open the checkout on two different browsers simultaneously. Try to place orders in quick succession.
- **What you should see:** One order succeeds. The second receives an out-of-stock error.
- **What it means if wrong:** If both orders go through, two customers have bought the same last unit. Call a developer — this is a critical issue.

---

### I. Emails

**I1 — Email arrives in inbox (not spam)**
- **What to do:** Complete a test purchase (card or ramburs) using a real email address you control.
- **What you should see:** The email arrives in the inbox, not the spam or junk folder, within two minutes.
- **What it means if wrong:** If it lands in spam, our domain authentication with Resend may need adjustment. Call a developer.
- **Where to look next:** Check the "From" address — it must show exactly "M27 Eyewear <comenzi@m27.ro>". If it shows a different sender or a Resend address, call a developer.

**I2 — Email sender is correct**
- **What to do:** Open the confirmation email. Check the sender field.
- **What you should see:** "M27 Eyewear" as the display name, comenzi@m27.ro as the email address.
- **What it means if wrong:** Any other address means the sending configuration is wrong.
- **Where to look next:** Call a developer.

**I3 — Email contents match the order**
- **What to do:** Compare the confirmation email with the order in the admin panel.
- **What you should see:** The order reference, item names and colours, quantity, prices, discount (if any), shipping cost, and total all match exactly.
- **What it means if wrong:** Mismatch between email and order means the data passed to the email system was wrong at the time of sending. Call a developer.

**I4 — Exactly one email per card order**
Covered in E5 above.

---

### J. Admin Panel

**J1 — Login with correct password**
- **What to do:** Open m27.ro/admin27.html. Enter the admin password.
- **What you should see:** The admin panel loads showing the orders dashboard.
- **What it means if wrong:** Correct password but login fails — call a developer (the password environment variable may have changed).

**J2 — Login with wrong password**
- **What to do:** Open m27.ro/admin27.html. Enter a wrong password and press Enter.
- **What you should see:** The input field shakes, an error message appears, and the panel does not load.
- **What it means if wrong:** If a wrong password lets you in, security is broken — call a developer immediately.

**J3 — Orders appear and are current**
- **What to do:** Log in to the admin panel. Compare the order list against what you know was placed (for example, after a test purchase).
- **What you should see:** Your test order appears at the top with the correct status, customer name, and total.
- **What it means if wrong:** Order is missing — see Part 6.

**J4 — Changing a status sticks after refresh**
- **What to do:** Find an order. Change its status to "shipped." Close and reopen the admin panel.
- **What you should see:** The status still shows "shipped." It was saved to the database.
- **What it means if wrong:** If the status reverts, the PATCH request to the database failed silently. Call a developer.

**J5 — Editing stock sticks after refresh**
- **What to do:** In the Products tab, change the stock of any variant. Close and reopen the admin panel.
- **What you should see:** The new stock figure is displayed.
- **What it means if wrong:** Stock is reverting — the save request is failing. Call a developer.

**J6 — KPI figures match reality**
- **What to do:** After a known test purchase, look at the revenue figure shown in the admin panel header.
- **What you should see:** The total revenue has increased by the amount of your test purchase.
- **What it means if wrong:** Figures are incorrect. Call a developer.

---

### K. Cookie Banner and Tracking

**K1 — Banner appears on first visit**
- **What to do:** Open a private/incognito browser window. Go to m27.ro.
- **What you should see:** After about 1 second, a cookie consent banner slides up from the bottom-right corner. It has three options: "Acceptă," "Refuză," and "Setări cookies."
- **What it means if wrong:** Banner does not appear — tracking is likely loading for everyone regardless of consent, which is illegal under GDPR. Call a developer.

**K2 — Declining means no tracking loads**
- **What to do:** In a private/incognito window, open m27.ro. When the banner appears, click "Refuză." Then right-click anywhere on the page → Inspect → Console tab. Type `window.gtag` and press Enter.
- **What you should see:** The console returns "undefined" — meaning Google Analytics has not loaded.
- **What it means if wrong:** If `window.gtag` returns a function, GA4 is loading without consent. Call a developer.

**K3 — Accepting means tracking loads**
- **What to do:** In a private/incognito window, open m27.ro. Accept cookies. Type `window.gtag` in the browser console.
- **What you should see:** The console returns a function (not "undefined"). This confirms GA4 has loaded.
- **What it means if wrong:** Tracking does not load even after acceptance. Check the GA4 property in Google Analytics to see if data is arriving. If not, call a developer.

**K4 — Banner does not reappear after a choice**
- **What to do:** Accept or decline cookies. Refresh the page.
- **What you should see:** The banner does not reappear. Your choice was saved.
- **What it means if wrong:** Banner appears on every page load — the choice is not being stored. Call a developer.

**K5 — Verifying data arrives in Google Analytics**
- **What to do:** Log in to analytics.google.com. Open the M27 Eyewear property. Go to Reports → Realtime.
- **What you should see:** Within 30 seconds of visiting m27.ro (after accepting cookies), you appear as an active user on the realtime report.
- **What it means if wrong:** No realtime data after accepting cookies — GA4 is not loading correctly or the property ID is wrong. Call a developer.

**K6 — Verifying data arrives in Meta Events Manager**
- **What to do:** Log in to Facebook Business Manager. Go to Events Manager → M27 pixel. Click "Test Events."
- **What you should see:** When you visit m27.ro and accept cookies, a "PageView" event appears in the Test Events panel.
- **What it means if wrong:** No event arrives — Meta Pixel is not loading correctly. Call a developer.

---

### L. Newsletter

**L1 — Signup stores the email**
- **What to do:** Scroll to the bottom of the homepage. Enter a real email address in the newsletter field and press Enter or click the arrow button.
- **What you should see:** The form is replaced by a "Te-ai abonat ✓" success message.
- **What it means if wrong:** An error message appears or nothing happens. The email may not be saved.
- **Where to look next:** Check the Supabase "subscribers" table for the email you entered. If it is missing, call a developer.

**L2 — Verify the email is in Supabase**
- **What to do:** Log in to Supabase → Table Editor → subscribers. Find the email you just used.
- **What you should see:** A row with your email, source "footer," and a recent created_at timestamp.
- **What it means if wrong:** Row not present — the API call failed. Call a developer.

**L3 — Duplicate signup does not show an error**
- **What to do:** Enter the same email address a second time and submit.
- **What you should see:** The same "Te-ai abonat ✓" success message. No error about the email already existing.
- **What it means if wrong:** An error message appears — the duplicate-handling logic is broken. Call a developer.

---

### M. Mobile

**M1 — Full purchase journey on a real phone**
- **What to do:** On a real phone (iPhone or Android), open m27.ro in the mobile browser. Browse to a product, add it to the cart, proceed to checkout, fill in details, and submit as ramburs. (Use ramburs for the mobile test to avoid a real card charge.)
- **What you should see:** Every step works: product page loads with correct layout, cart shows correct total, checkout form is easy to fill on mobile (fields are large, keyboard does not cover the submit button), confirmation page loads correctly.
- **What it means if wrong:** Any step that is unusable, overlapping, or broken on mobile is a layout bug.
- **Where to look next:** Call a developer with a screenshot.

**M2 — Floating add-to-cart button on product page (mobile)**
- **What to do:** On a phone, open any product page and scroll down past the product image.
- **What you should see:** A sticky button appears at the bottom of the screen that lets you add to cart without scrolling back up.
- **What it means if wrong:** Button is missing or overlaps other content. Call a developer.

**M3 — Mobile navigation menu**
- **What to do:** On a phone, tap the menu icon at the top of the page.
- **What you should see:** A slide-down or dropdown menu with navigation links. Tapping a link closes the menu and navigates to the correct page.
- **What it means if wrong:** Menu does not open, or links are broken, or menu does not close. Call a developer.

**M4 — Mobile cart summary in checkout**
- **What to do:** On a phone, proceed to checkout with items in the cart. Tap the order summary toggle at the top of the checkout page.
- **What you should see:** A dropdown expands showing the items in the order, discount, shipping, and total. The total shown at the top of the toggle should match the total in the dropdown.
- **What it means if wrong:** Numbers do not match, or the toggle does not expand. Call a developer.

---

### 10-Minute Daily Health Check

Run these every morning once the site is live, before the business day starts. Each takes under a minute.

1. **Site loads:** Open m27.ro in a fresh browser tab. Confirm it loads within 3 seconds and the homepage looks normal.

2. **New orders:** Open the admin panel. Check for any overnight orders that arrived while no one was watching. Ramburs orders need to be reviewed and handed to fulfilment. Paid (card) orders also need fulfilment.

3. **Stripe overnight activity:** Log in to Stripe. Go to Payments. Filter by "Last 24 hours." Confirm all payments show "Succeeded." If any show "Failed" after showing "Succeeded" earlier, a refund may have occurred — investigate.

4. **Email delivery:** Check the Resend dashboard. Look for any failed sends in the last 24 hours. If any confirmation emails failed, contact those customers manually with their order details.

5. **Stock levels:** In the admin panel Products tab, quickly scan for any product variants sitting at 0 or 1 in stock. If critical models are out of stock, take action before the store opens for the day.

If all five checks are green, the site is healthy. Any anomaly, refer to Part 6 or call a developer.

---

*Last updated: August 2026*
*Maintained by the M27 Eyewear development team*
