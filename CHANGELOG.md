# Changelog

## [Unreleased]

### Added

- Modo aislado de pruebas de Mercado Pago mediante `PAYMENT_MODE=test`.
- Página de resultado de prueba y URL de notificación configurable para validar webhooks.

### Changed

- Los pagos de prueba no se envían a la planilla de pedidos de producción y se identifican con el prefijo `TEST-`.
