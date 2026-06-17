async function main() {
  console.log(JSON.stringify({
    skipped: true,
    reason: 'legacy graph-walk eval retired after LGS cutover. Use LGS smoke/parity tests.'
  }, null, 2));
}

main().catch(console.error);
