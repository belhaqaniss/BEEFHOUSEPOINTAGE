export const expenseCategories={purchase:'Achat',payroll:'Paie'} as const;
export type ExpenseCategory=keyof typeof expenseCategories;
export function readExpenseNote(note=''):{category:ExpenseCategory|'';text:string}{
  for(const category of Object.keys(expenseCategories) as ExpenseCategory[]){
    const prefix=`[${expenseCategories[category]}]`;
    if(note.startsWith(prefix))return {category,text:note.slice(prefix.length).trimStart()};
  }
  return {category:'',text:note};
}
export const writeExpenseNote=(category:ExpenseCategory|'',text='')=>category?`[${expenseCategories[category]}]${text.trim()?` ${text.trim()}`:''}`:text;
export const expenseLabel=(note?:string)=>{const {category}=readExpenseNote(note);return category?expenseCategories[category]:'Non précisé'};
