import { realpathSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';

// 수동 live smoke 전용: 평가 사진이 저장소 안에 있으면 거부한다(개인 사진을 저장소에 두지 않기 위해).
// 상대경로·`.`·`..`를 정규화한 경로와, symlink를 따라간 실제 경로를 모두 저장소 root(실제 경로)와 비교한다.
// 둘 중 하나라도 저장소 안이면 거부한다 — 저장소 밖을 가리키는 저장소 안의 symlink도 거부한다.
// 파일 시스템 sandbox가 아니며, 사진 사용 동의 여부를 확인하지 않는다.

export const REPOSITORY_ROOT = realpathSync(resolve(__dirname, '..'));

const inside = (path: string, root: string) => {
  const rel = relative(root, path);
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
};

// true면 사용 금지(저장소 안이거나 존재하지 않는 경로)
export function isRepositoryImagePath(imagePath: string, cwd = process.cwd(), root = REPOSITORY_ROOT): boolean {
  const lexical = resolve(cwd, imagePath);
  let real: string;
  try {
    real = realpathSync(lexical);
  } catch {
    return true; // 존재하지 않는 경로는 허용하지 않는다
  }
  // cwd 자체가 symlink를 거치는 경우까지 포함해 저장소 root의 두 표기(실제·요청 기준)를 모두 비교
  const lexicalRoot = resolve(root);
  return inside(lexical, lexicalRoot) || inside(real, root) || inside(resolve(realpathSync(cwd), imagePath), root);
}
