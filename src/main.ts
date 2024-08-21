import { closeSync, existsSync, openSync, unlinkSync, writeFileSync, writeSync } from 'fs';
import { join } from 'path';
import { addArrays, readDataPackage, tallyCheckCount, readSpoiler, spawnAP, tallyInventory } from './util';
import { Keeper } from './keeper';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const inventory = async (...logs: string[]) =>
  Promise.all([...logs.map((i) => tallyInventory(`apmega-session${i}.log`))]).then((result) => {
    const total = result.shift();
    if (!total) return;
    for (const list of result)
      for (const entry of list.entries()) total.set(entry[0], total.get(entry[0])!.concat(entry[1]).sort());

    if (existsSync('current-inventory.txt')) unlinkSync('current-inventory.txt');
    const inv = openSync('current-inventory.txt', 'w');
    for (const [game, items] of total.entries()) {
      writeSync(inv, `${game}:\n`);
      let lastItem = items.shift();
      if (!lastItem) writeSync(inv, '- Nothing yet\n\n');
      else {
        writeSync(inv, `- ${lastItem}`);
        let count = 1;
        for (const item of items) {
          if (item == lastItem) count++;
          else {
            lastItem = item;
            writeSync(inv, (count > 1 ? ` ×${count}` : '') + `\n- ${lastItem}`);
            count = 1;
          }
        }
        writeSync(inv, (count > 1 ? ` ×${count}` : '') + `\n\n`);
      }
    }
    closeSync(inv);
  });

(async () => {
  const { AP_DIR, AP_GAME, AP_DPK } = process.env;
  const keeper = new Keeper();

  // const spoiler = 'C:\\ProgramData\\Archipelago\\output\\AP_04204754304751644198\\AP_04204754304751644198_Spoiler.txt';
  // const spoiler = 'C:\\ProgramData\\Archipelago\\output\\AP_23961766504119312078\\AP_23961766504119312078_Spoiler.txt';

  if (AP_DIR == undefined) console.error('AP_DIR (path to ArchipelagoServer.exe) not defined in env');
  else if (!existsSync(join(AP_DIR, 'ArchipelagoServer.exe')))
    console.error(`ArchipelagoServer.exe not found at AP_DIR (${AP_DIR})`);
  else if (AP_GAME == undefined) console.error('AP_GAME (AP multiworld file or .zip containing it) not defined in env');
  else await spawnAP(AP_DIR, AP_GAME, keeper);

  // await tallyCheckCount('apmega-session03-1.log');
  // await tallyCheckCount('apmega-session03-2.log');
  // const datapkg = AP_DPK ? await readDataPackage(AP_DPK) : undefined;
  // await readSpoiler(spoiler);
  // await readSpoiler(spoiler, datapkg);

  keeper.close();
})();
