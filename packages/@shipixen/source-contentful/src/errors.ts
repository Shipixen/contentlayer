import { errorToString } from '@shipixen/utils'
import { Tagged } from '@shipixen/utils/effect'

export class UnknownContentfulError extends Tagged('UnknownContentfulError')<{ readonly error: unknown }> {
  toString = () => `UnknownContentfulError: ${errorToString(this.error)}`
}
