import 'package:flutter_test/flutter_test.dart';
import 'package:geduc_rag/core/auth/auth_user.dart';
import 'package:geduc_rag/core/storage/local_preferences.dart';
import 'package:geduc_rag/core/tenancy/tenant_context.dart';
import 'package:shared_preferences/shared_preferences.dart';

AuthUser _user(List<TenantRef> tenants) => AuthUser(
  id: 'u1',
  name: 'Ana',
  email: 'ana@rag.local',
  profiles: const <String>[],
  permissions: const <String>{},
  tenants: tenants,
);

const _a = TenantRef(id: 'a', name: 'A');
const _b = TenantRef(id: 'b', name: 'B');

void main() {
  setUp(() => SharedPreferences.setMockInitialValues(<String, Object>{}));

  test('sem preferência salva, ativa o primeiro vínculo', () async {
    final context = TenantContext(LocalPreferences());
    await context.syncWith(_user([_a, _b]));
    expect(context.activeTenantId, 'a');
  });

  test('restaura o tenant salvo quando ainda é vínculo válido', () async {
    SharedPreferences.setMockInitialValues(<String, Object>{
      'active_tenant_id': 'b',
    });
    final context = TenantContext(LocalPreferences());
    await context.syncWith(_user([_a, _b]));
    expect(context.activeTenantId, 'b');
  });

  test('ignora tenant salvo que deixou de ser vínculo', () async {
    SharedPreferences.setMockInitialValues(<String, Object>{
      'active_tenant_id': 'x',
    });
    final context = TenantContext(LocalPreferences());
    await context.syncWith(_user([_a]));
    expect(context.activeTenantId, 'a');
  });

  test('select só aceita vínculos e persiste a escolha', () async {
    final context = TenantContext(LocalPreferences());
    await context.syncWith(_user([_a, _b]));
    await context.select('zzz');
    expect(context.activeTenantId, 'a');
    await context.select('b');
    expect(context.activeTenantId, 'b');
    expect(await LocalPreferences().readActiveTenantId(), 'b');
  });

  test('sem vínculo, não há tenant ativo; clear zera', () async {
    final context = TenantContext(LocalPreferences());
    await context.syncWith(_user(const []));
    expect(context.activeTenantId, isNull);
    await context.syncWith(_user([_a]));
    context.clear();
    expect(context.activeTenantId, isNull);
    expect(context.available, isEmpty);
  });
}
