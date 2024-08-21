# Archimegalo log reader/API server

Reads Archipelago server log output and saves it to a dated file for later use. Also provides live data via a small API server.

## .env file

Please set your environment file accordingly:

- `AP_DIR`: the path where Archipelago lives (`ArchipelagoServer.exe` as this script currently assumes Windows precompiled binaries)
- `AP_GAME`: the `.archipelago` or `.zip` file you want it to load (can be relative to `AP_DIR`)
- `SRV_PORT`: *Optional.* The port where API data will be served. Defaults to 22422.

## Operation

Yarn is recommended for package management. Start by typing `yarn` to set up the environment (assuming Yarn is properly installed), then `yarn start` will do a clean build of the project and run it.

## API Endpoints

`/total`: The total number of checks both sent and received by each game.
`/sincelast`: The number of checks sent and received by each game since the last time this endpoint was queried. Returns HTTP 204 if no checks were read from the server.

### Output

```typescript
interface APTally {
  checksRcvd: number[];
  checksSent: number[];
  total: number;
}
```

## Other

Several utility functions also exist in `util.ts` to assist with reading server logs to count checks or assemble an inventory, reading a spoiler file to count total checks per game, and reading a saved datapackage JSON (which mostly is for filtering out non-items from the spoiler file while counting). Nothing is really well documented at the moment; apologies for that!
