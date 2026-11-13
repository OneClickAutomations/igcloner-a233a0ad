export function selectedShotVersion<T extends {id:string;scene_id:string;scene_revision:number;operation:string;status:string;result_url:string|null}>(scene:{id:string;revision:number;selected_attempt_id?:string|null},attempts:T[]):T|undefined {
  const versions=attempts.filter(a=>a.scene_id===scene.id&&a.scene_revision===scene.revision&&a.operation==='animate'&&a.status==='completed'&&a.result_url);
  return versions.find(a=>a.id===scene.selected_attempt_id)??versions[0];
}