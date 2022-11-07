/**
 * @NApiVersion 2.x
 * @NScriptType Suitelet
 * @NModuleScope Public
 */
/*
ID        		    : customscript_zk_sl_xm_close_so_pa
Name                : ZK SL XM Close Sales Order
Purpose             : Close Sales Order linked to Product Allocation
Created On          : December 29,2021
Author              : Ceana Technology
Script Type         : Suitelet Script
Saved Searches      : NONE
*/
define(['N/file', 'N/task', 'N/ui/serverWidget', 'N/format','N/record'],

    function (file, task, serverWidget, format,record) {
        const PENDING_STATUS = 4;
        const TYPE_DELETE = 2;

        function onRequest(context) {
            try {

                if (context.request.method === 'GET') {

                    if (context.request.parameters['processtype'] == 'clientscript') {

                        var intProductAllocationId = context.request.parameters.id;

                        log.debug("intProductAllocationId", intProductAllocationId);

                        var blResult = processMapReduce(intProductAllocationId);

                        if (blResult) {
                            context.response.write('true');
                        }
                    }
                } else {

                }
            } catch (e) {
                log.error('error onRequest', e)
            }
        }

        function processMapReduce(intProductAllocationId) {
            try {
                var mrTaskID = runMRTask(intProductAllocationId);
                return true;

            } catch (err) {
                log.error('processMapReduce' + err);
            }
        }

        function runMRTask(intProductAllocationId) {
            try {
                var scriptTask = task.create({
                    taskType: task.TaskType.MAP_REDUCE,
                    scriptId: "customscript_zk_mr_xm_close_so_pa",
                    deploymentId: "customdeploy_zk_mr_xm_close_so_pa",
                    params:{
                        custscript_zk_xm_pa_id: intProductAllocationId
                    }
                });
                log.debug('scriptTask', scriptTask);
                return scriptTask.submit();
            } catch (err) {
                log.error('error in runMRTask func:',err)
            }
        }
        return {
            onRequest: onRequest
        };

    });
