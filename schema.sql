-- ─────────────────────────────────────────
-- M27 Eyewear — Supabase Schema
-- Run this in: Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────

-- Enable UUID generation
create extension if not exists "pgcrypto";


-- ── PRODUCTS ──────────────────────────────
create table products (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),
  name             text not null,          -- e.g. "Palladium"
  model            text,                   -- e.g. "Praga" (frame shape)
  colorway         text,                   -- e.g. "Full Black"
  price            numeric(10,2) not null,
  stock_quantity   integer not null default 0,
  image_url        text,
  gomag_url        text,
  active           boolean not null default true
);


-- ── CUSTOMERS ─────────────────────────────
create table customers (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  email        text not null unique,
  name         text,
  phone        text
);


-- ── ORDERS ────────────────────────────────
create table orders (
  id                   uuid primary key default gen_random_uuid(),
  created_at           timestamptz not null default now(),
  customer_name        text not null,
  customer_email       text not null,
  customer_phone       text,
  delivery_type        text not null check (delivery_type in ('locker', 'home')),
  locker_id            text,              -- Sameday locker ID (delivery_type = locker)
  address              text,              -- Full address (delivery_type = home)
  total_amount         numeric(10,2) not null,
  status               text not null default 'pending'
                         check (status in ('pending','paid','processing','shipped','delivered','cancelled','refunded')),
  stripe_payment_id    text,
  sameday_awb          text               -- AWB tracking number from Sameday
);


-- ── ORDER ITEMS ───────────────────────────
create table order_items (
  id                 uuid primary key default gen_random_uuid(),
  order_id           uuid not null references orders(id) on delete cascade,
  product_id         uuid not null references products(id) on delete restrict,
  quantity           integer not null check (quantity > 0),
  price_at_purchase  numeric(10,2) not null
);


-- ── INDEXES ───────────────────────────────
create index on orders (customer_email);
create index on orders (status);
create index on orders (created_at desc);
create index on order_items (order_id);
create index on order_items (product_id);
create index on products (active);


-- ── STOCK DECREMENT RPC ──────────────────
-- Atomically decrements stock for multiple products.
-- items JSON format: [{"pid": "<uuid>", "q": <int>}, ...]
-- Raises an exception (rolls back) if any product has insufficient stock.
create or replace function decrement_stock(items jsonb)
returns void language plpgsql as $$
declare
  item         jsonb;
  rows_updated int;
begin
  for item in select * from jsonb_array_elements(items) loop
    update products
       set stock_quantity = stock_quantity - (item->>'q')::int
     where id = (item->>'pid')::uuid
       and stock_quantity >= (item->>'q')::int;
    get diagnostics rows_updated = row_count;
    if rows_updated = 0 then
      raise exception 'Out of stock: product_id=%', item->>'pid';
    end if;
  end loop;
end;
$$;

grant execute on function decrement_stock(jsonb) to authenticated;


-- ── ROW LEVEL SECURITY ────────────────────
-- Enable RLS on all tables (serverless functions use service role key → bypass RLS)
alter table products    enable row level security;
alter table customers   enable row level security;
alter table orders      enable row level security;
alter table order_items enable row level security;

-- Public can read active products (for the storefront)
create policy "public can read active products"
  on products for select
  using (active = true);

-- No public write access — all writes go through serverless functions with service role key


-- ── SUBSCRIBERS ───────────────────────────
create table subscribers (
  id          uuid primary key default gen_random_uuid(),
  email       text not null unique,
  created_at  timestamptz not null default now(),
  source      text not null default 'footer'
);

create index on subscribers (created_at desc);

alter table subscribers enable row level security;
-- No public access — reads/writes via service role key only
