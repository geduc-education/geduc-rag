import { PaginationQueryDto } from '../../../../common/dto/pagination.dto';

/** Query de `GET /documents` (`page`/`limit`). */
export class ListDocumentsDto extends PaginationQueryDto {}
