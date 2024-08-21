import { spawn } from 'child_process';
import { createWriteStream } from 'fs';
import { readFile } from 'fs/promises';
import { APTally, Keeper } from './keeper';

interface APDataPackage {
  games: Map<string, APDataPackageGame>;
  version: number;
}

interface APDataPackageGame {
  checksum: string;
  item_name_to_id: Map<string, number>;
  location_name_to_id: Map<string, number>;
}

const gameList = [
  'Bumper Stickers',
  'Meritous',
  'A Link to the Past',
  'Timespinner',
  'TUNIC',
  'A Short Hike',
  'CrossCode',
  'Astalon',
  'Metroid Zero Mission',
  'Symphony of the Night',
  'Manual_KirbyForgottenLand_TailsMK4',
  'Manual_FFXIV_Silasary',
];

const checkPattern = /Slot (\d+) sent (.*) to Slot (\d+)/;
const locPattern = /(.*) \(Slot (\d+)\): (.*) \(Slot (\d+)\)/;

const readDataPackage = async (pkgfile: string) =>
  readFile(pkgfile).then((buf) => JSON.parse(buf.toString()) as APDataPackage);

const tallyCheckCount = async (log: string):Promise<APTally> =>
  readFile(log)
    .then((buf) =>
      buf
        .toString()
        .split('\n')
        .map((i) => i.trim())
        .filter((i) => checkPattern.test(i)),
    )
    .then((checks) => {
      const send = Array(12).fill(0),
        recv = Array(12).fill(0);
      for (const check of checks) {
        const parse = checkPattern.exec(check);
        if (!parse) continue;
        send[Number.parseInt(parse[1]) - 1]++;
        recv[Number.parseInt(parse[3]) - 1]++;
      }
      console.debug('Sent:', send, 'Received:', recv);
      return {
        checksRcvd: recv,
        checksSent: send,
        total: send.reduce((r, i) => r + i)
      };
    });

const tallyInventory = async(log:string):Promise<Map<string, string[]>> => 
  readFile(log)
    .then((buf) =>
      buf
        .toString()
        .split('\n')
        .map((i) => i.trim())
        .filter((i) => checkPattern.test(i)),
    )
    .then((checks) => {
      const retval = new Map<string, string[]>(), items:string[][] = [];
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for (const _ in gameList) items.push([]);
      for (const check of checks) {
        const parse = checkPattern.exec(check);
        if (!parse) continue;
        items[Number.parseInt(parse[3]) - 1].push(parse[2]);
      }
      for (const game in items) retval.set(gameList[game], items[game]);
      return retval;
    });

const readSpoiler = async (spoiler: string, datapkg?: APDataPackage) =>
  readFile(spoiler)
    .then((buf) =>
      buf
        .toString()
        .split('\n')
        .map((i) => i.trim()),
    )
    .then((lines) => {
      const start = lines.indexOf('Locations:') + 2;
      const end = lines.indexOf('Playthrough:') - 1;
      if (start <= 0 || end <= 0 || end < start) throw new Error('Error determining location list position');

      const locs = lines
        .slice(start, end)
        .map((i) => locPattern.exec(i))
        .filter((i) => i != null);
      if (datapkg) {
        let dpkcomplete = true;
        for (const game of gameList) dpkcomplete &&= Object.keys(datapkg.games).includes(game);

        if (dpkcomplete) {
          const gamepkg: APDataPackageGame[] = Array(12);
          for (const game of Object.entries(datapkg.games))
            if (gameList.includes(game[0])) gamepkg[gameList.indexOf(game[0])] = game[1];

          for (const loc of locs.slice()) {
            if (loc == null) continue;
            const from = Number.parseInt(loc[2]) - 1,
              to = Number.parseInt(loc[4]) - 1;
            if (isNaN(from) || isNaN(to)) console.warn('Could not determine slot numbers:', loc[0]);
            else if (
              !(
                Object.keys(gamepkg[from].location_name_to_id).includes(loc[1]) &&
                Object.keys(gamepkg[to].item_name_to_id).includes(loc[3])
              )
            )
              locs.splice(locs.indexOf(loc), 1);
          }
        } else console.warn('Cannot compare to incomplete data package');
      }
      console.info(`This log has ${locs.length} checks in it`);

      const itemcount = Array<number>(12).fill(0);
      for (const loc of locs) {
        if (loc == null) continue;
        const to = Number.parseInt(loc[4]) - 1;
        if (isNaN(to)) console.warn('Could not determine recipient slot number:', loc[0]);
        itemcount[to]++;
      }
      console.info(itemcount);
      return itemcount;
    });

const spawnAP = async (path: string, game: string, keeper: Keeper) =>
  new Promise<number>(async (f, r) => {
    const ap = spawn('ArchipelagoServer.exe', ['--host', 'localhost', game], {
      cwd: path,
      stdio: ['inherit', 'pipe', 'pipe'],
    });
    const startTime = new Date(Date.now());
    const logfile = createWriteStream(`apmega-${startTime.toISOString().replaceAll(':', '-')}.log`);
    let data = '';
    //ap.stdout.pipe(process.stdout);
    ap.stdout.pipe(logfile);
    ap.stderr.pipe(process.stderr);
    ap.stdout.on('data', (ch) => {
      if (typeof ch == 'string') data += ch;
      else data += (ch as Buffer).toString();
      const lines = data.split('\n').map((i) => i.trim());
      data = lines.pop()!;
      for (const line of lines) {
        const parse = checkPattern.exec(line);
        if (parse == null) console.info(line);
        else {
          const from = Number.parseInt(parse[1]) - 1,
            to = Number.parseInt(parse[3]) - 1;
          if (isNaN(from) || isNaN(to)) console.warn('Could not determine slot numbers:', parse[0]);
          else {
            console.info(`${gameList[from]} → ${parse[2]} → ${gameList[to]}`);
            keeper.check(from, to);
          }
        }
      }
    });
    ap.on('close', (c) => {
      logfile.close();
      c == 0 ? f(0) : r(c);
    });
  });

const addArrays = (...arrays: Array<Array<number>>) => {
  arrays.reduce((r, i) => {
    if (r < 0) return i.length;
    else if (r != i.length) throw Error('Arrays not of same length');
    else return r;
  }, -1);

  const base = arrays.shift();
  if (base) for (const arr of arrays) arr.forEach((i, x) => (base[x] += i));
  return base;
};

export { readDataPackage, tallyCheckCount, tallyInventory, readSpoiler, spawnAP, addArrays, gameList, checkPattern, locPattern };
