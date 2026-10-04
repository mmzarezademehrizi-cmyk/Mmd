# FilePal Relay (Cloudflare Workers)

رلهٔ رایگان روی Cloudflare (Workers + Durable Objects، بدون سرور و بدون کارت بانکی).

## نصب (یک‌بار)
1. حساب رایگان Cloudflare بساز.
2. Node.js را نصب کن (nodejs.org).
3. داخل همین پوشه در ترمینال:

       npx wrangler login
       npx wrangler deploy

4. آخر دستور آدرسی مثل `https://filepal-relay.NAME.workers.dev` می‌دهد.
5. در اپ FilePal → تنظیمات → «سرور رله» همین دامنه را بنویس (`filepal-relay.NAME.workers.dev`) روی هر دو دستگاه.

هر دستگاه یک «کد اینترنتی» نشان می‌دهد؛ در «اتصال دستی» کد + PIN را بزن.
