import { NPCId, ALL_NPC_IDS } from './NPCData'

const STORAGE_KEY = 'npc_states'

export interface NPCStateData {
  npcId: NPCId
  currentLocationIndex: number
  currentDialogueIndex: number
  allLinesDelivered: boolean
  artefactCollected: boolean
}

function defaultState(id: NPCId): NPCStateData {
  return {
    npcId: id,
    currentLocationIndex: 0,
    currentDialogueIndex: 0,
    allLinesDelivered: false,
    artefactCollected: false,
  }
}

export function loadNPCStates(): Map<NPCId, NPCStateData> {
  const map = new Map<NPCId, NPCStateData>()
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, NPCStateData>
      for (const id of ALL_NPC_IDS) {
        map.set(id, parsed[id] ?? defaultState(id))
      }
      return map
    }
  } catch { /* ignore corrupt data */ }

  for (const id of ALL_NPC_IDS) {
    map.set(id, defaultState(id))
  }
  return map
}

export function saveNPCStates(states: Map<NPCId, NPCStateData>): void {
  const obj: Record<string, NPCStateData> = {}
  for (const [id, state] of states) {
    obj[id] = state
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(obj))
  } catch { /* storage full — silently fail */ }
}
