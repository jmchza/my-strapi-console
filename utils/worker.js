const INVOICE_BUILDER_QUEUE = "Inoive_Builder_queue"
const INVOICE_GENERATOR_QUEUE = "Invoice_Generator_queue"
const SEND_EPOST_QUEUE = "EPost_queue"
const DUNNING_CONTRACT_QUEUE = "Dunning_Contract_queue"
const LETTER_BUILD_QUEUE = "Letter_Builder_queue"
const MONTHLY_SELLER_SETTLEMENT_QUEUE = "Monthly_Seller_Settlement_queue"
const SUBROGATION_LETTER_QUEUE = "Subrogation_Letter_queue"
const ASSIGNMENT_AGREEMENT_LETTER_QUEUE = "Assignment_Agreement_Letter_queue"

const uuid = require("node-uuid")

function makeInvoiceFile(invoice) {
  const correlationId = (invoice && invoice.id) || uuid.v4()
  strapi.rabbitmq
    .sendToQueue(INVOICE_BUILDER_QUEUE, invoice, {
      correlationId
    })
    .then(() => {
      console.log(`[Worker] Sent invoice to make file for number ${invoice && invoice.invoiceNumber}`)
    })
}

async function generateInvoice(data) {
  const correlationId = data.user.id || uuid.v4()
  const response = await strapi.rabbitmq.sendToQueue(INVOICE_GENERATOR_QUEUE, data, {
    correlationId
  })
  console.log(`[Worker] Generated invoice`)
  return response
}

async function generateSubrogationLetter(data, correlationId) {
  correlationId = correlationId || data.user.id || uuid.v4()
  const response = await strapi.rabbitmq.sendToQueue(SUBROGATION_LETTER_QUEUE, data, {
    correlationId
  })
  console.log(`[Worker] Generated subrogation letter`)
  return response
}

async function generateAssignmentAgreementLetter(data, correlationId) {
  correlationId = correlationId || data.user.id || uuid.v4()
  const response = await strapi.rabbitmq.sendToQueue(ASSIGNMENT_AGREEMENT_LETTER_QUEUE, data, {
    correlationId
  })
  console.log(`[Worker] Generated assignment agreement letter`)
  return response
}

function sendEpost(data) {
  console.log("[Worker] sendEpost triggered")
  const correlationId = (data && data.invoice && data.invoice.id) || (data && data.data && data.data.id) || uuid.v4()
  strapi.rabbitmq
    .sendToQueue(SEND_EPOST_QUEUE, data, {
      correlationId
    })
    .then(() => {
      console.log(
        `[Worker] Sent epost of ${(data && data.type) || `invoice`} ${(data && (data.invoice && data.invoice.id)) ||
          (data && data.data && data.data.id)}`
      )
    })
}

async function generateLetter(data) {
  const correlationId = uuid.v4()
  const response = await strapi.rabbitmq.sendToQueue(LETTER_BUILD_QUEUE, data, {
    correlationId
  })
  console.log(`[Worker] Generated letter`)
  return response
}

async function prefillDunningContract(data) {
  //TODO use userId
  const correlationId = uuid.v4()
  strapi.rabbitmq
    .sendToQueue(DUNNING_CONTRACT_QUEUE, data, {
      correlationId
    })
    .then(() => {
      console.log(`[Worker] Pre-fill dunning contract for...`)
    })
}

async function generateMonthlySellerSettlement(data) {
  const correlationId = uuid.v4()
  const response = await strapi.rabbitmq.sendToQueue(MONTHLY_SELLER_SETTLEMENT_QUEUE, data, {
    correlationId
  })
  console.log(`[Worker] Generating monthly seller settlement`)
  return response
}

module.exports = {
  makeInvoiceFile,
  generateInvoice,
  generateSubrogationLetter,
  sendEpost,
  generateLetter,
  prefillDunningContract,
  generateAssignmentAgreementLetter,
  generateMonthlySellerSettlement
}
