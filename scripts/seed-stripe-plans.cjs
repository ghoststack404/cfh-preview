
require("dotenv").config({ path: ".env" });
const { PrismaClient } = require("@prisma/client");
const Stripe = require("stripe");

const STRIPE_KEY = process.env.STRIPE_SECRET_KEY || "";
const isMockMode = !STRIPE_KEY || STRIPE_KEY.trim() === "";

let stripe = null;
if (!isMockMode) {
  stripe = new Stripe(STRIPE_KEY, { apiVersion: "2023-10-16" });
}

const prisma = new PrismaClient();

const PLANS_CONFIG = [
  { tier: "BASIC", code: "PLAN_BASIC", name: "Plan B�sico", description: "Lo esencial para empezar", price: 0, commissionBps: 2500, hasCourseBuilder: false, hasAiCopilot: false },
  { tier: "CURSOS_ONLY", code: "PLAN_CURSOS", name: "Cursos Starter", description: "Para vender cursos pregrabados", price: 15000, commissionBps: 2000, hasCourseBuilder: true, hasAiCopilot: false },
  { tier: "ELITE", code: "PLAN_ELITE", name: "Plan �lite", description: "Todo para crecer tu negocio", price: 30000, commissionBps: 1500, hasCourseBuilder: true, hasAiCopilot: true, monthlyAiCredits: 100 },
];

async function main() {
  console.log("Syncing Stripe Plans...");

  for (const config of PLANS_CONFIG) {
    let plan = await prisma.subscriptionPlan.findUnique({ where: { tier: config.tier } });
    
    let stripeProductId = null;
    let stripePriceId = null;

    if (config.price > 0 && !isMockMode) {
      if (plan && plan.stripeProductId) {
         stripeProductId = plan.stripeProductId;
         stripePriceId = plan.stripePriceId;
         console.log(`Plan ${config.name} already exists in Stripe.`);
      } else {
         const product = await stripe.products.create({
           name: config.name,
           description: config.description,
           metadata: { tier: config.tier }
         });
         
         const price = await stripe.prices.create({
           product: product.id,
           unit_amount: config.price,
           currency: "mxn",
           recurring: { interval: "month" },
         });

         stripeProductId = product.id;
         stripePriceId = price.id;
         console.log(`Created Stripe Product & Price for ${config.name}`);
      }
    } else if (config.price > 0 && isMockMode) {
      console.log(`[MOCK] Skiping Stripe creation for ${config.name} because STRIPE_SECRET_KEY is empty.`);
    }

    if (!plan) {
      plan = await prisma.subscriptionPlan.create({
        data: {
           code: config.code,
           tier: config.tier,
           name: config.name,
           description: config.description,
           monthlyPriceCents: config.price,
           currency: "MXN",
           commissionBps: config.commissionBps,
           hasCourseBuilder: config.hasCourseBuilder,
           hasAiCopilot: config.hasAiCopilot,
           monthlyAiCredits: config.monthlyAiCredits || 0,
           stripeProductId,
           stripePriceId
        }
      });
      console.log(`Created DB Plan: ${plan.name}`);
    } else {
      plan = await prisma.subscriptionPlan.update({
        where: { tier: config.tier },
        data: { stripeProductId, stripePriceId }
      });
      console.log(`Updated DB Plan: ${plan.name}`);
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());

