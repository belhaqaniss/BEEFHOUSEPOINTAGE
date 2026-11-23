export const offeredCategories={professional:'Repas professionnel',influencer:'Table influenceur'} as const;
export type OfferedCategory=keyof typeof offeredCategories;

// Store the category in the existing persisted note, so older servers preserve it.
export function readOfferedNote(note=''):{category:OfferedCategory|'';text:string}{
  for(const category of Object.keys(offeredCategories) as OfferedCategory[]){
    const prefix=`[${offeredCategories[category]}]`;
    if(note.startsWith(prefix))return {category,text:note.slice(prefix.length).trimStart()};
  }
  return {category:'',text:note};
}
export function writeOfferedNote(category:OfferedCategory|'',text=''){
  return category?`[${offeredCategories[category]}]${text.trim()?` ${text.trim()}`:''}`:text;
}
export const offeredLabel=(note?:string)=>{const {category}=readOfferedNote(note);return category?offeredCategories[category]:'Non précisé'};
