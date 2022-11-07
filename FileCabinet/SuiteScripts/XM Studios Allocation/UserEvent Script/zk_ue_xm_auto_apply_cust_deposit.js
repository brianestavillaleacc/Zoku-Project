/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 * @NModuleScope Public
 */

/*
ID                  : 
Name                : 
Purpose             : UE used to auto apply invocie
Created On          : March 9, 2022
Author              : Ceana Technology
Script Type         : User Event
Saved Searches      : 
*/

define(['N/record'], function(record)  {
    
    function afterSubmit (context)  {
        try{
            const newRecord = context.newRecord
            log.debug('context type', context.type)

            if(context.type != 'create') return
    
            const intSalesOrder = newRecord.getValue({fieldId: 'salesorder'})
            log.debug('intSalesOrder', intSalesOrder)
            const objRelatedRecords = getSalesOrderRelatedRecords(intSalesOrder)
            const arrCustomerDeposit  = objRelatedRecords.customerDeposits.filter(function(obj) {return (obj.status == 'Not Deposited' || obj.status == 'Deposited')})
            const arrInvoices = objRelatedRecords.invoices.filter(function(obj) {return obj.status == 'Open'})

            log.debug('arrCustomerDeposit', arrCustomerDeposit)
            log.debug('arrInvoices', arrInvoices)
            arrCustomerDeposit.forEach(function(objCustomerDeposit) {
                createDepositApplciationAndApplyInvoice(objCustomerDeposit.id, arrInvoices)
            })
        }catch(objError){
            log.error('error catched', objError)
        }
    }

    function createDepositApplciationAndApplyInvoice(intCustomerDepositId, arrInvoices) {

        const recDepositApplication = record.transform({
            fromType: record.Type.CUSTOMER_DEPOSIT,
            fromId: intCustomerDepositId,
            toType: record.Type.DEPOSIT_APPLICATION,
        })

        log.debug('after transform', 'log')

        var intApplyLineCount =  recDepositApplication.getLineCount({
            sublistId: 'apply'
        })
        log.debug('createDepositApplciationAndApplyInvoice intApplyLineCount', intApplyLineCount)

        if(intApplyLineCount == 0) {
            return
        }

        for(var lineIndx=0; lineIndx<intApplyLineCount; lineIndx++) {
            var intApplyInvoiceId = recDepositApplication.getSublistValue({
                sublistId: 'apply',
                fieldId: 'doc',
                line: lineIndx
            })

            arrInvoices.forEach(function(objInvoice) {
                if(objInvoice.id == intApplyInvoiceId) {
                    recDepositApplication.setSublistValue({
                        sublistId: 'apply',
                        fieldId: 'apply',
                        line: lineIndx,
                        value: true
                    })
                }
            })
        }

        recDepositApplication.save()

        log.debug('intApplyLineCount', intApplyLineCount)
    }

    function getSalesOrderRelatedRecords(intSalesOrder) {
        const objResult = {
            invoices: [],
            customerDeposits: []
        }
        const recSO = record.load({
            type: record.Type.SALES_ORDER,
            id: intSalesOrder
        })

        var intRelatedRecordsLineCount = recSO.getLineCount({
            sublistId: 'links'
        })
        if(intRelatedRecordsLineCount == 0) return objResult

        log.debug('line count', intRelatedRecordsLineCount)
        for(var intIndx=0; intIndx<intRelatedRecordsLineCount; intIndx++) {
            var stLineType = recSO.getSublistValue({
                sublistId: 'links',
                fieldId: 'type',
                line: intIndx
            })
            var stStatus = recSO.getSublistValue({
                sublistId: 'links',
                fieldId: 'status',
                line: intIndx
            })
            var intId = recSO.getSublistValue({
                sublistId: 'links',
                fieldId: 'id',
                line: intIndx
            })
            if(stLineType == 'Invoice') {
                objResult.invoices.push({id: intId, type: stLineType, status: stStatus})
            }
            if(stLineType == 'Customer Deposit') {
                objResult.customerDeposits.push({id: intId, type: stLineType, status: stStatus})
            }
        }
        log.debug('getSalesOrderRelatedRecords', objResult)
        return objResult
    }

    return {afterSubmit: afterSubmit}
})