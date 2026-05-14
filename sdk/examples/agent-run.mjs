/**
 * I am an agent. I want to find a skill and execute it via x402.
 * Zero URL overrides — SDK defaults point at skillmint-0g.vercel.app.
 */
import { SkillMintClient } from "../dist/index.js";

const PRIVATE_KEY = process.env.PRIVATE_KEY;
if (!PRIVATE_KEY) { console.error("PRIVATE_KEY env required"); process.exit(1); }

const client = new SkillMintClient({
  privateKey: PRIVATE_KEY,
  network: "testnet",
  // no oracleUrl, no x402Url — using SDK defaults (skillmint-0g.vercel.app)
});

async function main() {
  console.log("=== SkillMint Agent Run ===");
  console.log(`Agent wallet : ${client.address}`);

  // 1. Check W0G balance
  const w0g = await client.getW0GBalance();
  console.log(`W0G balance  : ${w0g} W0G`);

  // 2. Discover all active skills
  console.log("\n[1] Discovering skills...");
  const skills = await client.listSkills({ concurrency: 3 });
  console.log(`Found ${skills.length} active skill(s):`);
  for (const s of skills) {
    console.log(`  #${s.id}  "${s.metadata?.name || "(no name)"}"  price=${s.price} W0G`);
  }

  if (skills.length === 0) {
    console.log("No active skills — nothing to execute.");
    return;
  }

  // 3. Pick the cheapest skill
  const skill = skills.reduce((a, b) => (a.priceWei <= b.priceWei ? a : b));
  console.log(`\n[2] Picked skill #${skill.id}: "${skill.metadata?.name || "unnamed"}"`);
  console.log(`    Price : ${skill.price} W0G`);
  console.log(`    Model : ${skill.model}`);

  // 4. Execute via x402 (autoWrap=true: SDK auto-wraps A0GI if W0G is low)
  const input = "Summarize what SkillMint is in one sentence.";
  console.log(`\n[3] Executing skill #${skill.id} via x402...`);
  console.log(`    Input: "${input}"`);
  const t0 = Date.now();

  const result = await client.executeX402(skill.id, input, undefined, { autoWrap: true });

  console.log(`    Done in ${Date.now() - t0}ms`);
  console.log(`    Output       : ${result.output}`);
  console.log(`    Receipt root : ${result.receiptRootHash}`);
  console.log(`    Settle tx    : ${result.settlement?.transaction || "(none)"}`);
  console.log(`    Paid         : ${result.paidW0G} W0G`);

  // 5. Verify receipt integrity
  console.log("\n[4] Fetching + verifying receipt from 0G Storage...");
  try {
    const receipt = await client.fetchReceipt(result.receiptRootHash);
    const v = client.verifyReceipt(receipt);
    console.log(`    valid      : ${v.valid}`);
    console.log(`    inputHash  : ${v.inputHashOk}`);
    console.log(`    outputHash : ${v.outputHashOk}`);
    console.log(`    teeVerified: ${v.teeVerified}`);
  } catch (e) {
    console.log(`    receipt verify skipped (storage propagation): ${e.message}`);
  }

  console.log("\n=== Agent run complete ===");
}

main().catch(e => { console.error("FAILED:", e.message); process.exit(1); });
