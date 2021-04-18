class DAOBase{
    query(id:string){

    }
}

export default class extends DAOBase{
    id: string = 'finish'

    queryAll(){
        this.query('select')
    }
}
