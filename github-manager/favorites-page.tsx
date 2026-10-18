import {
  HStack,
  Image,
  List,
  Section,
  Text,
  VStack,
  useState,
} from "scripting"
import { useFavorites } from "./favorites"
import { GLASS, StatusSurface } from "./glass-ui"
import { RepositoryRow } from "./repository-browser"

/** 本地收藏：与账户无关，切换或退出 Token 都不受影响。 */
export function FavoritesPage({ onSubscriptionsChange }: { onSubscriptionsChange?: () => void }) {
  const favorites = useFavorites()
  const [searchQuery, setSearchQuery] = useState("")
  const normalizedQuery = searchQuery.trim().toLocaleLowerCase()
  const visibleFavorites = favorites.filter(repository => !normalizedQuery || repository.fullName.toLocaleLowerCase().includes(normalizedQuery) || (repository.description ?? "").toLocaleLowerCase().includes(normalizedQuery))

  return (
    <List
      listStyle="inset"
      scrollContentBackground="hidden"
      scrollEdgeEffectHidden={{ edges: "top", hidden: true }}
      listRowBackground={<></>}
      listRowSeparator="hidden"
      navigationTitle="收藏"
      navigationBarTitleDisplayMode="inline"
      searchable={{ value: searchQuery, onChanged: setSearchQuery, placement: "toolbar", prompt: "搜索收藏的仓库" }}
      searchToolbarBehavior="minimize"
    >
      <Section listRowBackground={<></>} listRowSeparator="hidden">
        <VStack spacing={12} frame={{ maxWidth: "infinity" }} listRowBackground={<></>} listRowSeparator="hidden">
          <VStack spacing={6} alignment="leading" padding={{ horizontal: 16, vertical: 14 }} frame={{ maxWidth: "infinity", alignment: "leading" }} glassEffect={GLASS.content}>
            <HStack spacing={8}><Image systemName="bookmark.fill" font={15} foregroundStyle="systemYellow" /><Text font={18} fontWeight="semibold">本地收藏</Text></HStack>
            <Text font={12} foregroundStyle="secondaryLabel">{favorites.length > 0 ? `${favorites.length} 个仓库 · 仅保存在本机` : "仅保存在本机，与账户无关"}</Text>
          </VStack>
          {favorites.length === 0 ? <StatusSurface icon="bookmark" iconForegroundStyle="systemYellow" title="还没有收藏" detail="在探索、作者主页或 Stars 中轻点仓库，选择「收藏」。" /> : null}
          {favorites.length > 0 && visibleFavorites.length === 0 ? <StatusSurface icon="magnifyingglass" title="没有匹配的收藏" detail="换一个名称或描述关键词。" /> : null}
          {visibleFavorites.map(repository => <RepositoryRow key={repository.fullName} repository={repository} favorite={true} onSubscriptionsChange={onSubscriptionsChange} />)}
        </VStack>
      </Section>
    </List>
  )
}
