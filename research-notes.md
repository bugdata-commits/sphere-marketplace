# Marketplace research notes

## Jumia Nigeria homepage
- Search is a dominant header control with placeholder: “Search products, brands and categories”.
- Utility navigation exposes Sell on Jumia, JumiaPay, delivery, Account, Help, and Cart.
- Category navigation is explicit and broad: Official Store, Appliances, Phones & Tablets, Health & Beauty, Home & Office, Electronics, Fashion, Supermarket, Computing, Baby Products, Gaming, and more.
- Merchandising uses deal rails, campaign labels, countdown/limited-stock urgency, new arrivals, and dense product-card grids.
- Product cards foreground product title, current price, discount percentage, and stock/deal cues; the overall pattern is high-utility, high-density, mobile-commerce oriented.
- Brand/category landing modules help users browse by intent as well as search.

## Etsy Star Seller
- Official badge guidance centers reputation on measurable seller behaviors: speedy replies, smooth shipping, and strong reviews; the guidance references a 4.8+ rating threshold.
- The badge is positioned as a shopper-facing shortcut for identifying reliable sellers, even though Etsy notes the badge does not directly determine search ranking.

## Global marketplace patterns to apply
- Use a prominent hero search rather than a passive eyebrow message.
- Combine search with popular/trending query chips to reduce time-to-discovery.
- Use visible category shortcuts, clear product-card hierarchy, ratings/reviews, seller verification, delivery/escrow assurances, and limited-stock or featured labels.
- Keep trust signals close to decisions: seller identity on cards, protection/payment language near CTAs, and proof points in the hero or immediately below it.

## Trade Sphere implementation constraints
- Existing static files: index.html, affiliate.html, admin.html, assets/style.css, assets/app.js, assets/admin-auth.js, and image assets.
- Preserve script imports and existing Supabase/affiliate/admin behavior; redesign markup/CSS around existing hooks rather than replacing integrations.
- Existing homepage already has mobile nav/search, signup triggers, sections for categories/features/testimonials/trust/pricing, and reveal/stagger attributes.

## Verified global trust patterns
Amazon’s official guidance explicitly separates product reviews from seller feedback. Product reviews are intended to help customers decide whether the item is right for them, while seller feedback covers packaging, shipping, professionalism, quality, and issue resolution. Only customers who purchased through Amazon can rate a third-party seller, and seller averages appear beside the seller name. This supports using distinct product-rating and seller-reputation signals rather than one blended score.

Alibaba Trade Assurance frames trust as a visible process: pay through the platform, hold funds in escrow, release after receipt confirmation, and provide money back or mediation when terms are not met. It also pairs payment protection with shipping/logistics tracking, after-sales protection, and buyer testimonials. Trade Sphere should make the protection workflow legible near CTAs instead of hiding it in footer copy.

## Design direction for Trade Sphere
The redesign will combine Jumia’s utility-first African marketplace pattern (dominant search, clear categories, deal rails, product density, urgency cues) with Amazon/Etsy/Alibaba trust architecture (verified purchase reviews, seller reputation, seller badges, visible escrow/protection, delivery tracking, and clear support). The visual layer will remain dark and gold, but with more editorial spacing, stronger product-card hierarchy, and premium glass/metallic surfaces.

## Browser validation
- Local homepage rendered successfully with the new hero heading, prominent search bar, popular query chips, trust ribbon, category cards, trending product cards, seller verification labels, testimonials, pricing, affiliate CTA, and seller CTA.
- Primary “Start Selling” navigation control opened the existing signup modal, confirming that the preserved modal IDs and SphereDB signup wiring still initialize correctly.
- The site loaded without an obvious fatal runtime error in the rendered page.

## Remaining page smoke tests
The affiliate page rendered its referral-link creation form and dashboard lookup entry point. The admin page rendered its email/password gate and sign-in control, confirming that the existing affiliate and admin page flows remain present alongside the redesigned homepage.
