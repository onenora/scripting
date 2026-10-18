import { Navigation, Script } from "scripting"
import { errorMessage } from "./glass-ui"
import { loadLibrary } from "./library"
import { LibraryPage } from "./library-page"

async function run() {
  try {
    await Navigation.present({ element: <LibraryPage initialEntries={loadLibrary()} /> })
  } catch (error) {
    await Dialog.alert({ title: "无法打开书源库", message: errorMessage(error) })
  } finally {
    Script.exit()
  }
}

void run()
