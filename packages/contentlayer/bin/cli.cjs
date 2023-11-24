#!/usr/bin/env node

const main = async () => {
  const { run } = await import('@shipixen/cli')
  await run()
}

main().catch((e) => console.log(e))
