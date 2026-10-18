import StarredPage from "./starred-page"

/** Scripting 首页标签入口：直接显示完整界面，由 App 托管生命周期，不调用 Navigation.present 或 Script.exit。 */
export default function HomeScreen() {
  return <StarredPage homeScreen />
}
