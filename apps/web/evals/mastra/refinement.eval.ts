async function main() {
  console.log(JSON.stringify({
    skipped: true,
    reason: 'legacy refinement eval retired after LGS cutover.'
  }, null, 2));
}

main().catch(console.error);
