/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 */
/*
ID        		    : customscript_zk_mr_xm_close_so
Name                : ZK MR XM Close Sales Order
Purpose             : Close Sales Order
Created On          : Dec 29,2021
Author              : Ceana Technology
Script Type         : Map Reduce Script
Saved Searches      : NONE
*/
define(['N/record', 'N/search', 'N/runtime'],

    (record, search, runtime) => {

        var currScript = runtime.getCurrentScript();
        const getInputData = (inputContext) => {
            try {
                var intProductAllocId = JSON.parse(currScript.getParameter('custscript_zk_xm_pa_id'));
                var arrSOIds = [];
                var srSalesOrder = search.create({
                    type: search.Type.SALES_ORDER,
                    filters:
                        [
                            ["custcol_zoku_product_allocation", "anyof", intProductAllocId], "AND",
                            ["mainline", "is", "F"], "AND",
                            ["status","noneof",["SalesOrd:C","SalesOrd:H"]]
                        ]
                });
                srSalesOrder.run().each(function (result) {
                    const recProductAllocation = search.lookupFields({
                        type: 'customrecord_zk_product_allocation',
                        id: intProductAllocId,
                        columns: ['custrecord_zk_pa_item']
                    })
                    const intProductAllocationItem = recProductAllocation.custrecord_zk_pa_item.length == 0? '' :recProductAllocation.custrecord_zk_pa_item[0].value
                    if(intProductAllocationItem) {
                        const recItem = search.lookupFields({
                            type: search.Type.ITEM,
                            id: intProductAllocationItem,
                            columns: ['custitem_zk_advance_item']
                        })

                        arrSOIds.push({
                            intSOId: result.id,
                            intProductAllocationId: intProductAllocId,
                            intProductAllocationItem: intProductAllocationItem,
                            intAdvancedItem: recItem.custitem_zk_advance_item.length == 0? '': recItem.custitem_zk_advance_item[0].value
                        });
                    }
                    return true;
                });
                log.debug('arrSOIds', arrSOIds);
                return arrSOIds;
            } catch (error) {
                log.error('getInputStage-Error:', error);
            }

        }

        const map = (mapContext) => {
            try {
                var objValue = JSON.parse(mapContext.value);
                var recSO = record.load({
                    type: record.Type.SALES_ORDER,
                    id: objValue.intSOId,
                    isDynamic: true
                });
                var lineNumber = recSO.findSublistLineWithValue({
                    sublistId: 'item',
                    fieldId: 'custcol_zoku_product_allocation',
                    value: objValue.intProductAllocationId
                })

                log.debug("lineNumber", lineNumber);

                if(lineNumber != -1) {

                    const intLineCount = recSO.getLineCount({sublistId: 'item'})
                    for (var lineIndex=0; lineIndex<intLineCount;lineIndex++) {
                        recSO.selectLine({ sublistId: 'item', line: lineIndex });
                        const intItemId = recSO.getCurrentSublistValue({sublistId: 'item', fieldId: 'item'})
                        if(intItemId == objValue.intProductAllocationItem || intItemId == objValue.intAdvancedItem) {
                            recSO.setCurrentSublistValue({ sublistId: 'item', fieldId: 'isclosed', value: true, ignoreFieldChange: true });
                            recSO.commitLine({ sublistId: 'item', line: lineIndex });
                        }


                    }
                    recSO.save();
                }
            } catch (error) {
                log.error('map:error:',error)
            }
        }

        const reduce = (reduceContext) => {

        }

        const summarize = (summaryContext) => {

        }

        return {getInputData, map, reduce, summarize}

    });