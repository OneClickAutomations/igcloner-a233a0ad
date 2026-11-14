import { requestedPromptChanges } from './prompt-magic';
export function selectedShotVersion<T extends {id:string;scene_id:string;scene_revision:number;operation:string;status:string;result_url:string|null}>(scene:{id:string;revision:number;selected_attempt_id?:string|null},attempts:T[]):T|undefined {
  const versions=attempts.filter(a=>a.scene_id===scene.id&&a.scene_revision===scene.revision&&a.operation==='animate'&&a.status==='completed'&&a.result_url);
  return versions.find(a=>a.id===scene.selected_attempt_id)??versions[0];
}

export function changesShotAppearance(instruction: string): boolean {
  return /\b(?:vitiligo|pigmentation|patch(?:es)?|skin|complexion|hair|blond|blonde|dreadlocks?|outfit|bikini|clothing|dress|wear|wearing|hat|glasses|physique|build|muscular)\b/i.test(requestedPromptChanges(instruction));
}
export function shotReviewInstruction(scene: { revision: number; review_history?: unknown }): string {
  const history = Array.isArray(scene.review_history) ? scene.review_history : [];
  const last = history.at(-1) as { instruction?: string; revision?: number } | undefined;
  return last && last.revision === scene.revision ? last.instruction ?? '' : '';
}
export const CHARACTER_CONTINUITY = 'Keep the approved starting-frame person identical from the first frame to the last: stable skin shade, the same visible pigmentation patches in the same locations, hair, build, outfit and accessories. Pigmentation is present from frame one, never appearing gradually. No skin transformation, morphing, lightening, fading patches or appearance changes during the action. Animate movement only; appearance instructions describe a constant look, not a transformation.';