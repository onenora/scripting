import { Navigation, Script } from "scripting"
import { StorePage } from "./store-page"

async function run() {
  await Navigation.present({ element: <StorePage /> })
  Script.exit()
}

void run()
