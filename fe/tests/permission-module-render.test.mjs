import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { getPermissionModuleLabel, PERMISSION_MODULES_23 } from '../src/utils/helpers/clinicConfigHelpers.js'

const renderModules = (modules) => renderToStaticMarkup(
    createElement('table', null, createElement('tbody', null,
        ...modules.map((module, index) => createElement('tr', { key: index },
            createElement('td', null, getPermissionModuleLabel(module, index)),
        )),
    )),
)

test('the initial permission catalog renders before bootstrap finishes loading', () => {
    const html = renderModules(PERMISSION_MODULES_23)
    assert.equal((html.match(/<tr>/g) || []).length, 23)
    for (const module of PERMISSION_MODULES_23) {
        assert.ok(html.includes(renderToStaticMarkup(createElement('td', null, module.tenPhanHe))))
    }
})

test('permission labels from the API render alongside module objects', () => {
    assert.equal(
        renderModules(['Quản trị', { tenPhanHe: 'Tiếp đón' }, { maPhanHe: 'CASHIER' }]),
        '<table><tbody><tr><td>Quản trị</td></tr><tr><td>Tiếp đón</td></tr><tr><td>CASHIER</td></tr></tbody></table>',
    )
})

test('malformed module labels render a neutral placeholder instead of crashing React', () => {
    assert.doesNotThrow(() => renderModules([null, undefined, {}, { tenPhanHe: {} }]))
    assert.equal(getPermissionModuleLabel(null, 2), 'Phân hệ 3')
})
