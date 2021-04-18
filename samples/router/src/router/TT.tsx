import {useObservable} from '@mybricks/rxui'

export default function T() {
  const obj = useObservable({id:'test'})
  return (
    <div>{obj.id}</div>
  )
}