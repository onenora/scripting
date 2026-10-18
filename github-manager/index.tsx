import { Navigation, Script } from "scripting"
import StarredPage from "./starred-page"

const PRESENTATION_STYLE_KEY = "github-star.presentation-style"
type PresentationStyle = "automatic" | "overFullScreen"
type PresentationResult =
  | { type: "close-script" }
  | { type: "change-presentation-style"; style: PresentationStyle }
  | undefined

function readPresentationStyle(): PresentationStyle {
  return Storage.get<string>(PRESENTATION_STYLE_KEY) === "overFullScreen" ? "overFullScreen" : "automatic"
}

/** 3.0 移除的功能残留的本地数据，启动时一次性清除。 */
function cleanupLegacyStorage() {
  const browsed = Storage.get<{ login: string }[]>("github-star.browsed-users")
  if (Array.isArray(browsed)) for (const user of browsed) Storage.remove(`github-star.browsed-user-snapshot.${user.login.toLowerCase()}`)
  for (const key of ["github-star.browsed-users", "github-star.bottom-tabs", "github-star.quick-owned-repository-id"]) Storage.remove(key)
}

async function run() {
  cleanupLegacyStorage()
  let result: PresentationResult
  do {
    result = await Navigation.present<PresentationResult>({
      element: <StarredPage presentationStyle={readPresentationStyle()} />,
      modalPresentationStyle: readPresentationStyle(),
    })
    if (result?.type === "change-presentation-style") {
      Storage.set(PRESENTATION_STYLE_KEY, result.style)
    }
  } while (result?.type === "change-presentation-style")
  Script.exit()
}

void run()
